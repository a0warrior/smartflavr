"use client"
import { useState } from "react"
import Link from "next/link"

export default function FollowersModal({ 
  username, 
  type,
  count
}: { 
  username: string
  type: "followers" | "following"
  count: number
}) {
  const [open, setOpen] = useState(false)
  const [users, setUsers] = useState<any[]>([])
  const [loading, setLoading] = useState(false)

  async function fetchUsers() {
    setLoading(true)
    const res = await fetch(`/api/follow/list?username=${username}&type=${type}`)
    const data = await res.json()
    setUsers(data.users || [])
    setLoading(false)
  }

  function handleOpen() {
    setOpen(true)
    fetchUsers()
  }

  return (
    <>
      <div onClick={handleOpen} className="cursor-pointer hover:opacity-70 transition text-center">
        <div className="text-lg font-medium text-gray-900">{count}</div>
        <div className="text-xs text-gray-400 capitalize">{type}</div>
      </div>

      {open && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl w-full max-w-sm mx-4 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
              <h2 className="text-sm font-medium capitalize">{type}</h2>
              <button onClick={() => setOpen(false)} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>
            <div className="max-h-96 overflow-y-auto">
              {loading ? (
                <div className="px-5 py-8 text-center text-sm text-gray-400">Loading...</div>
              ) : users.length === 0 ? (
                <div className="px-5 py-8 text-center text-sm text-gray-400">
                  No {type} yet
                </div>
              ) : (
                users.map((user: any) => (
                  <Link
                    key={user.id}
                    href={`/u/${user.username}`}
                    onClick={() => setOpen(false)}
                    className="flex items-center gap-3 px-5 py-3 hover:bg-gray-50 transition border-b border-gray-50">
                    {user.profile_image ? (
                      <img src={user.profile_image} className="w-10 h-10 rounded-full object-cover flex-shrink-0"/>
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-orange-500 flex items-center justify-center text-white font-medium flex-shrink-0">
                        {user.name?.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div>
                      <div className="text-sm font-medium text-gray-900">{user.name}</div>
                      <div className="text-xs text-gray-400">@{user.username}</div>
                      {user.bio && (
                        <div className="text-xs text-gray-500 mt-0.5 line-clamp-1">{user.bio}</div>
                      )}
                    </div>
                  </Link>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}