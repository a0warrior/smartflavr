"use client"
import { useSession } from "next-auth/react"
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import Navbar from "@/app/components/Navbar"
import { ClockIcon, WarningIcon } from "@/app/components/Icons"

function formatCode(val: string) {
  const clean = val.replace(/[^A-Za-z0-9]/g, "").toUpperCase()
  if (clean.length > 4) return clean.slice(0, 4) + "-" + clean.slice(4, 8)
  return clean
}

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
  const [deleteUserTarget, setDeleteUserTarget] = useState<any>(null)
  const [deletingUser, setDeletingUser] = useState(false)
  const [timeoutTarget, setTimeoutTarget] = useState<string | null>(null)

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

  async function revokeCode(code: string) {
    if (!confirm(`Revoke code ${code}? This will make it available again.`)) return
    await fetch("/api/admin", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code }),
    })
    setSuccess(`Code ${code} revoked!`)
    setTimeout(() => setSuccess(""), 2000)
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

  async function updateUserStatus(userId: string, status: string) {
    const action = status === "banned" ? "ban" : status === "suspended" ? "suspend" : "reactivate"
    if (!confirm(`Are you sure you want to ${action} this user?`)) return
    await fetch("/api/admin/users", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: userId, status }),
    })
    fetchData()
  }

  async function timeoutUser(userId: string, minutes: number) {
    await fetch("/api/admin/users", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: userId, timeout_minutes: minutes }),
    })
    setTimeoutTarget(null)
    fetchData()
  }

  async function grantPlan(userId: string, plan: string) {
    await fetch("/api/subscription", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "admin_grant", user_id: userId, plan }),
    })
    setSuccess(`Plan updated to ${plan}`)
    setTimeout(() => setSuccess(""), 2000)
    fetchData()
  }

  async function confirmDeleteUser() {
    if (!deleteUserTarget) return
    setDeletingUser(true)
    const res = await fetch("/api/admin/users", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: deleteUserTarget.id }),
    })
    const data = await res.json()
    if (data.error) {
      setError(data.error)
    }
    setDeletingUser(false)
    setDeleteUserTarget(null)
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
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-10">

        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-medium text-gray-900">Admin Panel</h1>
          <p className="text-sm text-gray-400 mt-1">Manage invite codes and users</p>
          <div className="flex gap-3 mt-4 text-sm">
            <div className="flex-1 bg-white border border-gray-100 rounded-xl px-3 py-2 text-center">
              <div className="font-medium text-gray-900">{users.length}</div>
              <div className="text-xs text-gray-400">Users</div>
            </div>
            <div className="flex-1 bg-white border border-gray-100 rounded-xl px-3 py-2 text-center">
              <div className="font-medium text-gray-900">{unusedCodes.length}</div>
              <div className="text-xs text-gray-400">Unused codes</div>
            </div>
            <div className="flex-1 bg-white border border-gray-100 rounded-xl px-3 py-2 text-center">
              <div className="font-medium text-gray-900">{usedCodes.length}</div>
              <div className="text-xs text-gray-400">Used codes</div>
            </div>
          </div>
        </div>

        {/* Tabs */}
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
            {/* Create code */}
            <div className="bg-white border border-gray-100 rounded-2xl p-4 sm:p-5 mb-6">
              <h2 className="text-sm font-medium mb-3">Create new invite code</h2>
              <div className="space-y-2 sm:space-y-0 sm:flex sm:gap-3">
                <input
                  value={newCode}
                  onChange={e => setNewCode(formatCode(e.target.value))}
                  placeholder="Leave blank to auto-generate"
                  className="w-full sm:flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none font-mono"
                  maxLength={9}
                />
                <div className="flex gap-2">
                  <button
                    onClick={() => setNewCode(generateCode())}
                    className="flex-1 sm:flex-none px-4 py-2 border border-gray-200 rounded-xl text-sm text-gray-500 hover:bg-gray-50">
                    Generate
                  </button>
                  <button
                    onClick={createCode}
                    disabled={loading}
                    className="flex-1 sm:flex-none px-4 py-2 bg-orange-500 text-white rounded-xl text-sm font-medium hover:bg-orange-600 disabled:opacity-50">
                    {loading ? "Creating..." : "Create"}
                  </button>
                </div>
              </div>
              {error && <p className="text-xs text-red-500 mt-2">{error}</p>}
              {success && <p className="text-xs text-green-600 mt-2">{success}</p>}
            </div>

            {/* Unused codes */}
            <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden mb-6">
              <div className="px-4 sm:px-5 py-3 border-b border-gray-100">
                <h2 className="text-sm font-medium">Unused codes ({unusedCodes.length})</h2>
              </div>
              {unusedCodes.length === 0 ? (
                <div className="px-5 py-8 text-center text-sm text-gray-400">No unused codes</div>
              ) : (
                <div className="divide-y divide-gray-50">
                  {unusedCodes.map((c: any) => (
                    <div key={c.code} className="px-4 sm:px-5 py-3 flex items-center justify-between gap-2">
                      <span className="font-mono text-sm font-medium text-gray-900">{c.code}</span>
                      <div className="flex gap-2 flex-shrink-0">
                        <button onClick={() => copyCode(c.code)} className="px-3 py-1 border border-gray-200 rounded-lg text-xs text-gray-500 hover:bg-gray-50">Copy</button>
                        <button onClick={() => deleteCode(c.code)} className="px-3 py-1 border border-red-200 rounded-lg text-xs text-red-400 hover:bg-red-50">Delete</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Used codes */}
            <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden">
              <div className="px-4 sm:px-5 py-3 border-b border-gray-100">
                <h2 className="text-sm font-medium">Used codes ({usedCodes.length})</h2>
              </div>
              {usedCodes.length === 0 ? (
                <div className="px-5 py-8 text-center text-sm text-gray-400">No used codes yet</div>
              ) : (
                <div className="divide-y divide-gray-50">
                  {usedCodes.map((c: any) => (
                    <div key={c.code} className="px-4 sm:px-5 py-3 flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <span className="font-mono text-sm font-medium text-gray-900">{c.code}</span>
                        <p className="text-xs text-gray-400 truncate">Used by {c.used_by_name || c.used_by_email}</p>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className="text-xs text-green-500 font-medium hidden sm:inline">Used ✓</span>
                        <button onClick={() => revokeCode(c.code)} className="px-3 py-1 border border-yellow-200 rounded-lg text-xs text-yellow-600 hover:bg-yellow-50">Revoke</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}

        {activeTab === "users" && (
          <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden">
            {/* Users header + search */}
            <div className="px-4 sm:px-5 py-3 border-b border-gray-100 space-y-2 sm:space-y-0 sm:flex sm:items-center sm:justify-between sm:gap-4">
              <h2 className="text-sm font-medium flex-shrink-0">All users ({filteredUsers.length}{userSearch ? ` of ${users.length}` : ""})</h2>
              <input
                value={userSearch}
                onChange={e => setUserSearch(e.target.value)}
                placeholder="Search users..."
                className="w-full sm:max-w-xs border border-gray-200 rounded-lg px-3 py-1.5 text-xs outline-none"
              />
            </div>

            <div className="divide-y divide-gray-50">
              {filteredUsers.length === 0 ? (
                <div className="px-5 py-8 text-center text-sm text-gray-400">No users found</div>
              ) : (
                filteredUsers.map((user: any) => (
                  <div key={user.id} className="px-4 sm:px-5 py-4">
                    {/* User info row */}
                    <div className="flex items-start gap-3">
                      {user.profile_image ? (
                        <img src={user.profile_image} className="w-9 h-9 rounded-full object-cover flex-shrink-0" />
                      ) : (
                        <div className="w-9 h-9 rounded-full bg-orange-500 flex items-center justify-center text-white text-sm font-medium flex-shrink-0">
                          {user.name?.charAt(0).toUpperCase()}
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-1.5 text-sm font-medium text-gray-900">
                          <span className="truncate">{user.name}</span>
                          {user.is_admin === 1 && <span className="text-xs bg-orange-50 text-orange-600 px-2 py-0.5 rounded-full flex-shrink-0">Admin</span>}
                          {user.plan === "premium" && <span className="text-xs bg-purple-50 text-purple-600 px-2 py-0.5 rounded-full flex-shrink-0 font-semibold">Premium</span>}
                          {user.plan === "pro" && <span className="text-xs bg-amber-50 text-amber-600 px-2 py-0.5 rounded-full flex-shrink-0 font-semibold">Pro</span>}
                          {user.status === "suspended" && <span className="text-xs bg-yellow-50 text-yellow-600 px-2 py-0.5 rounded-full flex-shrink-0">Suspended</span>}
                          {user.status === "banned" && <span className="text-xs bg-red-50 text-red-600 px-2 py-0.5 rounded-full flex-shrink-0">Banned</span>}
                          {user.post_timeout_until && new Date(user.post_timeout_until) > new Date() && (
                            <span className="text-xs bg-orange-50 text-orange-600 px-2 py-0.5 rounded-full flex-shrink-0 flex items-center gap-1"><ClockIcon size={11} />Timed out</span>
                          )}
                        </div>
                        <p className="text-xs text-gray-400 truncate mt-0.5">
                          {user.username ? `@${user.username}` : "No username"} · {user.email}
                        </p>
                        <div className="flex gap-4 text-xs text-gray-400 mt-1.5">
                          <span><span className="font-medium text-gray-700">{user.cookbook_count}</span> cookbooks</span>
                          <span><span className="font-medium text-gray-700">{user.recipe_count}</span> recipes</span>
                        </div>
                      </div>
                    </div>

                    {/* Action buttons */}
                    {user.email !== session?.user?.email && (
                      <div className="mt-3 pl-12 space-y-2">
                        <div className="flex flex-wrap gap-2">
                          <button
                            onClick={() => toggleAdmin(user.id, user.is_admin)}
                            className={`px-3 py-1.5 rounded-lg text-xs border transition ${user.is_admin === 1 ? "border-red-200 text-red-400 hover:bg-red-50" : "border-orange-200 text-orange-500 hover:bg-orange-50"}`}>
                            {user.is_admin === 1 ? "Remove admin" : "Make admin"}
                          </button>
                          {user.status === "active" || !user.status ? (
                            <>
                              <button onClick={() => updateUserStatus(user.id, "suspended")} className="px-3 py-1.5 rounded-lg text-xs border border-yellow-200 text-yellow-600 hover:bg-yellow-50 transition">Suspend</button>
                              <button onClick={() => updateUserStatus(user.id, "banned")} className="px-3 py-1.5 rounded-lg text-xs border border-red-200 text-red-500 hover:bg-red-50 transition">Ban</button>
                            </>
                          ) : (
                            <button onClick={() => updateUserStatus(user.id, "active")} className="px-3 py-1.5 rounded-lg text-xs border border-green-200 text-green-600 hover:bg-green-50 transition">Reactivate</button>
                          )}
                          {timeoutTarget !== user.id && (
                            <button onClick={() => setTimeoutTarget(user.id)} className="px-3 py-1.5 rounded-lg text-xs border border-orange-200 text-orange-500 hover:bg-orange-50 transition flex items-center gap-1"><ClockIcon size={12} />Timeout</button>
                          )}
                          {user.post_timeout_until && new Date(user.post_timeout_until) > new Date() && (
                            <button onClick={() => timeoutUser(user.id, 0)} className="px-3 py-1.5 rounded-lg text-xs border border-gray-200 text-gray-500 hover:bg-gray-50 transition">Clear timeout</button>
                          )}
                          <button onClick={() => setDeleteUserTarget(user)} className="px-3 py-1.5 rounded-lg text-xs border border-red-300 text-red-600 hover:bg-red-50 transition">Delete</button>
                        </div>
                        {/* Plan controls */}
                        <div className="flex flex-wrap gap-2">
                          {user.plan !== "pro" && <button onClick={() => grantPlan(user.id, "pro")} className="px-3 py-1.5 rounded-lg text-xs border border-amber-200 text-amber-600 hover:bg-amber-50 transition">Grant Pro</button>}
                          {user.plan !== "premium" && <button onClick={() => grantPlan(user.id, "premium")} className="px-3 py-1.5 rounded-lg text-xs border border-purple-200 text-purple-600 hover:bg-purple-50 transition">Grant Premium</button>}
                          {(user.plan === "pro" || user.plan === "premium") && <button onClick={() => grantPlan(user.id, "free")} className="px-3 py-1.5 rounded-lg text-xs border border-gray-200 text-gray-500 hover:bg-gray-50 transition">Set Free</button>}
                        </div>
                        {timeoutTarget === user.id && (
                          <div className="bg-orange-50 border border-orange-200 rounded-xl px-3 py-2.5">
                            <p className="text-xs text-orange-700 font-medium mb-2">Select timeout duration:</p>
                            <div className="flex flex-wrap gap-2">
                              {[["15m", 15], ["1h", 60], ["24h", 1440], ["7d", 10080]].map(([label, mins]) => (
                                <button key={label as string} onClick={() => timeoutUser(user.id, mins as number)}
                                  className="px-3 py-1.5 text-xs bg-white border border-orange-200 rounded-lg text-orange-600 hover:bg-orange-100 transition">
                                  {label}
                                </button>
                              ))}
                              <button onClick={() => setTimeoutTarget(null)} className="px-3 py-1.5 text-xs border border-gray-200 rounded-lg text-gray-400 hover:bg-gray-50 transition">Cancel</button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>

      {deleteUserTarget && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm mx-4">
            <div className="text-yellow-500 mb-3 flex justify-center"><WarningIcon size={32} /></div>
            <h2 className="text-lg font-medium text-center mb-2">Delete {deleteUserTarget.name}?</h2>
            <p className="text-sm text-gray-500 text-center mb-1">This will permanently delete:</p>
            <ul className="text-sm text-gray-500 mb-4 space-y-1 text-center">
              <li>Their account and profile</li>
              <li>All their cookbooks and recipes</li>
              <li>All their posts, comments, and follows</li>
              <li>Their meal plans, grocery lists, and inventory</li>
            </ul>
            <p className="text-sm text-gray-500 text-center mb-1">Their invite code will be freed up for reuse.</p>
            <p className="text-sm font-medium text-red-500 text-center mb-6">This cannot be undone.</p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteUserTarget(null)} className="flex-1 border border-gray-200 rounded-xl py-2 text-sm text-gray-500 hover:bg-gray-50">Cancel</button>
              <button onClick={confirmDeleteUser} disabled={deletingUser} className="flex-1 bg-red-500 text-white rounded-xl py-2 text-sm font-medium hover:bg-red-600 disabled:opacity-50">
                {deletingUser ? "Deleting..." : "Yes, delete user"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}