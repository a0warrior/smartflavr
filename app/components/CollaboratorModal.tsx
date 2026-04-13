"use client"
import { useState, useEffect } from "react"

export default function CollaboratorModal({
  cookbookId,
  collaborators,
  onClose
}: {
  cookbookId: string
  collaborators: any[]
  onClose: () => void
}) {
  const [friends, setFriends] = useState<any[]>([])
  const [inviteError, setInviteError] = useState("")
  const [inviteSuccess, setInviteSuccess] = useState("")
  const [loadingInvite, setLoadingInvite] = useState<string | null>(null)
  const [manualUsername, setManualUsername] = useState("")
  const [localCollaborators, setLocalCollaborators] = useState(collaborators)

  useEffect(() => {
    fetchFriends()
  }, [])

  async function fetchFriends() {
    const res = await fetch("/api/friends")
    const data = await res.json()
    setFriends(data.friends || [])
  }

  async function inviteByUsername(username: string) {
    setInviteError("")
    setInviteSuccess("")
    setLoadingInvite(username)
    const res = await fetch("/api/collaborators", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cookbook_id: cookbookId, username }),
    })
    const data = await res.json()
    if (data.error) {
      setInviteError(data.error)
    } else {
      setInviteSuccess(`${username} invited!`)
      const res2 = await fetch(`/api/collaborators?cookbook_id=${cookbookId}`)
      const data2 = await res2.json()
      setLocalCollaborators(data2.collaborators || [])
    }
    setLoadingInvite(null)
  }

  async function removeCollaborator(userId: string) {
    await fetch("/api/collaborators", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cookbook_id: cookbookId, user_id: userId }),
    })
    const res = await fetch(`/api/collaborators?cookbook_id=${cookbookId}`)
    const data = await res.json()
    setLocalCollaborators(data.collaborators || [])
  }

  const collaboratorIds = localCollaborators.map((c: any) => c.id)
  const uninvitedFriends = friends.filter((f: any) => !collaboratorIds.includes(f.id))

  return (
    <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl w-full max-w-sm mx-4 max-h-[90vh] overflow-y-auto">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-sm font-medium">Collaborators</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">✕</button>
        </div>

        <div className="p-5">
          {uninvitedFriends.length > 0 && (
            <div className="mb-5">
              <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-3">Friends</p>
              <div className="space-y-2">
                {uninvitedFriends.map((friend: any) => (
                  <div key={friend.id} className="flex items-center justify-between py-2 border-b border-gray-50">
                    <div className="flex items-center gap-2">
                      {friend.profile_image ? (
                        <img src={friend.profile_image} className="w-8 h-8 rounded-full object-cover"/>
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-orange-500 flex items-center justify-center text-white text-xs font-medium">
                          {friend.name?.charAt(0)}
                        </div>
                      )}
                      <div>
                        <div className="text-sm font-medium">{friend.name}</div>
                        <div className="text-xs text-gray-400">@{friend.username}</div>
                      </div>
                    </div>
                    <button
                      onClick={() => inviteByUsername(friend.username)}
                      disabled={loadingInvite === friend.username}
                      className="px-3 py-1 bg-orange-500 text-white rounded-lg text-xs font-medium hover:bg-orange-600 disabled:opacity-50">
                      {loadingInvite === friend.username ? "Inviting..." : "Invite"}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {uninvitedFriends.length === 0 && localCollaborators.length === 0 && (
            <div className="text-center py-4 mb-4">
              <p className="text-sm text-gray-400">No friends to invite yet.</p>
              <p className="text-xs text-gray-400 mt-1">Follow people and have them follow you back to invite them.</p>
            </div>
          )}

          <div className="mb-4">
            <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">Invite by username</p>
            <div className="flex gap-2">
              <input
                value={manualUsername}
                onChange={e => setManualUsername(e.target.value)}
                placeholder="username"
                className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none"
              />
              <button
                onClick={() => {
                  if (manualUsername.trim()) {
                    inviteByUsername(manualUsername.trim())
                    setManualUsername("")
                  }
                }}
                className="px-4 py-2 bg-orange-500 text-white rounded-lg text-sm font-medium hover:bg-orange-600">
                Invite
              </button>
            </div>
            {inviteError && <p className="text-xs text-red-500 mt-1">{inviteError}</p>}
            {inviteSuccess && <p className="text-xs text-green-600 mt-1">{inviteSuccess}</p>}
          </div>

          {localCollaborators.length > 0 && (
            <div>
              <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-3">Current collaborators</p>
              <div className="space-y-2">
                {localCollaborators.map((c: any) => (
                  <div key={c.id} className="flex items-center justify-between py-2 border-b border-gray-50">
                    <div className="flex items-center gap-2">
                      {c.profile_image ? (
                        <img src={c.profile_image} className="w-7 h-7 rounded-full object-cover"/>
                      ) : (
                        <div className="w-7 h-7 rounded-full bg-orange-500 flex items-center justify-center text-white text-xs">
                          {c.name?.charAt(0)}
                        </div>
                      )}
                      <div>
                        <div className="text-sm font-medium">{c.name}</div>
                        <div className="text-xs text-gray-400">
                          @{c.username} · {c.status === "pending" ? "⏳ Pending" : c.status === "accepted" ? "✓ Accepted" : "✗ Declined"}
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => removeCollaborator(c.id)}
                      className="text-xs text-red-400 hover:text-red-600">
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}