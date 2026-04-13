"use client"
import { useSession } from "next-auth/react"
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import Navbar from "@/app/components/Navbar"

function generateCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
  let code = ""
  for (let i = 0; i < 4; i++) code += chars[Math.floor(Math.random() * chars.length)]
  code += "-"
  for (let i = 0; i < 4; i++) code += chars[Math.floor(Math.random() * chars.length)]
  return code
}

export default function AdminPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [codes, setCodes] = useState([])
  const [users, setUsers] = useState([])
  const [newCode, setNewCode] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")
  const [activeTab, setActiveTab] = useState<"codes" | "users">("codes")
  const [userSearch, setUserSearch] = useState("")

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login?code=returning")
    if (status === "authenticated") fetchData()
  }, [status])

  async function fetchData() {
    const res = await fetch("/api/admin")
    if (res.status === 403) {
      router.push("/dashboard")
      return
    }
    const data = await res.json()
    setCodes(data.codes || [])
    setUsers(data.users || [])
  }

  async function createCode() {
    const code = newCode || generateCode()
    setLoading(true)
    setError("")
    setSuccess("")
    const res = await fetch("/api/admin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code }),
    })
    const data = await res.json()
    if (data.error) {
      setError(data.error)
    } else {
      setSuccess(`Code ${code} created!`)
      setNewCode("")
      fetchData()
    }
    setLoading(false)
  }

  async function deleteCode(code: string) {
    if (!confirm(`Delete code ${code}?`)) return
    await fetch("/api/admin", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code }),
    })
    fetchData()
  }

  function copyCode(code: string) {
    navigator.clipboard.writeText(code)
    setSuccess(`Copied ${code}!`)
    setTimeout(() => setSuccess(""), 2000)
  }

  async function toggleAdmin(userId: string, currentStatus: number) {
    await fetch("/api/admin/users", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: userId, is_admin: currentStatus === 1 ? 0 : 1 }),
    })
    fetchData()
  }

  if (status === "loading") {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>
  }

  const usedCodes = codes.filter((c: any) => c.used_by !== null)
  const unusedCodes = codes.filter((c: any) => c.used_by === null)
  const filteredUsers = users.filter((user: any) =>
    user.name?.toLowerCase().includes(userSearch.toLowerCase()) ||
    user.username?.toLowerCase().includes(userSearch.toLowerCase()) ||
    user.email?.toLowerCase().includes(userSearch.toLowerCase())
  )

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <div className="max-w-4xl mx-auto px-6 py-10">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-medium text-gray-900">Admin Panel</h1>
            <p className="text-sm text-gray-400 mt-1">Manage invite codes and users</p>
          </div>
          <div className="flex gap-3 text-sm">
            <div className="bg-white border border-gray-100 rounded-xl px-4 py-2 text-center">
              <div className="font-medium text-gray-900">{users.length}</div>
              <div className="text-xs text-gray-400">Total users</div>
            </div>
            <div className="bg-white border border-gray-100 rounded-xl px-4 py-2 text-center">
              <div className="font-medium text-gray-900">{unusedCodes.length}</div>
              <div className="text-xs text-gray-400">Unused codes</div>
            </div>
            <div className="bg-white border border-gray-100 rounded-xl px-4 py-2 text-center">
              <div className="font-medium text-gray-900">{usedCodes.length}</div>
              <div className="text-xs text-gray-400">Used codes</div>
            </div>
          </div>
        </div>

        <div className="flex gap-2 mb-6">
          <button
            onClick={() => setActiveTab("codes")}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition ${activeTab === "codes" ? "bg-orange-500 text-white" : "bg-white border border-gray-200 text-gray-500 hover:bg-gray-50"}`}>
            Invite Codes
          </button>
          <button
            onClick={() => setActiveTab("users")}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition ${activeTab === "users" ? "bg-orange-500 text-white" : "bg-white border border-gray-200 text-gray-500 hover:bg-gray-50"}`}>
            Users
          </button>
        </div>

        {activeTab === "codes" && (
          <>
            <div className="bg-white border border-gray-100 rounded-2xl p-5 mb-6">
              <h2 className="text-sm font-medium mb-4">Create new invite code</h2>
              <div className="flex gap-3">
                <input
                  value={newCode}
                  onChange={e => setNewCode(e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, ""))}
                  placeholder="Leave blank to auto-generate"
                  className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none font-mono"
                  maxLength={9}
                />
                <button
                  onClick={() => setNewCode(generateCode())}
                  className="px-4 py-2 border border-gray-200 rounded-xl text-sm text-gray-500 hover:bg-gray-50">
                  Generate
                </button>
                <button
                  onClick={createCode}
                  disabled={loading}
                  className="px-4 py-2 bg-orange-500 text-white rounded-xl text-sm font-medium hover:bg-orange-600">
                  {loading ? "Creating..." : "Create"}
                </button>
              </div>
              {error && <p className="text-xs text-red-500 mt-2">{error}</p>}
              {success && <p className="text-xs text-green-600 mt-2">{success}</p>}
            </div>

            <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden mb-6">
              <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
                <h2 className="text-sm font-medium">Unused codes ({unusedCodes.length})</h2>
              </div>
              {unusedCodes.length === 0 ? (
                <div className="px-5 py-8 text-center text-sm text-gray-400">No unused codes</div>
              ) : (
                <div className="divide-y divide-gray-50">
                  {unusedCodes.map((c: any) => (
                    <div key={c.code} className="px-5 py-3 flex items-center justify-between">
                      <span className="font-mono text-sm font-medium text-gray-900">{c.code}</span>
                      <div className="flex gap-2">
                        <button
                          onClick={() => copyCode(c.code)}
                          className="px-3 py-1 border border-gray-200 rounded-lg text-xs text-gray-500 hover:bg-gray-50">
                          Copy
                        </button>
                        <button
                          onClick={() => deleteCode(c.code)}
                          className="px-3 py-1 border border-red-200 rounded-lg text-xs text-red-400 hover:bg-red-50">
                          Delete
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden">
              <div className="px-5 py-3 border-b border-gray-100">
                <h2 className="text-sm font-medium">Used codes ({usedCodes.length})</h2>
              </div>
              {usedCodes.length === 0 ? (
                <div className="px-5 py-8 text-center text-sm text-gray-400">No used codes yet</div>
              ) : (
                <div className="divide-y divide-gray-50">
                  {usedCodes.map((c: any) => (
                    <div key={c.code} className="px-5 py-3 flex items-center justify-between">
                      <div>
                        <span className="font-mono text-sm font-medium text-gray-900">{c.code}</span>
                        <span className="text-xs text-gray-400 ml-3">Used by {c.used_by_name || c.used_by_email}</span>
                      </div>
                      <span className="text-xs text-green-500 font-medium">Used ✓</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}

        {activeTab === "users" && (
          <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden">
            <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between gap-4">
              <h2 className="text-sm font-medium">All users ({filteredUsers.length}{userSearch ? ` of ${users.length}` : ""})</h2>
              <input
                value={userSearch}
                onChange={e => setUserSearch(e.target.value)}
                placeholder="Search by name, username or email..."
                className="flex-1 max-w-xs border border-gray-200 rounded-lg px-3 py-1.5 text-xs outline-none"
              />
            </div>
            <div className="divide-y divide-gray-50">
              {filteredUsers.length === 0 ? (
                <div className="px-5 py-8 text-center text-sm text-gray-400">No users found</div>
              ) : (
                filteredUsers.map((user: any) => (
                  <div key={user.id} className="px-5 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {user.profile_image ? (
                        <img src={user.profile_image} className="w-9 h-9 rounded-full object-cover"/>
                      ) : (
                        <div className="w-9 h-9 rounded-full bg-orange-500 flex items-center justify-center text-white text-sm font-medium">
                          {user.name?.charAt(0).toUpperCase()}
                        </div>
                      )}
                      <div>
                        <div className="text-sm font-medium text-gray-900 flex items-center gap-2">
                          {user.name}
                          {user.is_admin === 1 && (
                            <span className="text-xs bg-orange-50 text-orange-600 px-2 py-0.5 rounded-full">Admin</span>
                          )}
                        </div>
                        <div className="text-xs text-gray-400">
                          {user.username ? `@${user.username}` : "No username set"} · {user.email}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="flex gap-4 text-xs text-gray-400">
                        <div className="text-center">
                          <div className="font-medium text-gray-900">{user.cookbook_count}</div>
                          <div>cookbooks</div>
                        </div>
                        <div className="text-center">
                          <div className="font-medium text-gray-900">{user.recipe_count}</div>
                          <div>recipes</div>
                        </div>
                      </div>
                      {user.email !== session?.user?.email && (
                        <button
                          onClick={() => toggleAdmin(user.id, user.is_admin)}
                          className={`px-3 py-1 rounded-lg text-xs border transition ${user.is_admin === 1 ? "border-red-200 text-red-400 hover:bg-red-50" : "border-orange-200 text-orange-500 hover:bg-orange-50"}`}>
                          {user.is_admin === 1 ? "Remove admin" : "Make admin"}
                        </button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}