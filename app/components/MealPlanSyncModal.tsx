"use client"
import { useState, useEffect } from "react"
import { ClockIcon } from "@/app/components/Icons"

export default function MealPlanSyncModal({ onClose, onSyncChange }: { onClose: () => void, onSyncChange: () => void }) {
  const [syncs, setSyncs] = useState<any[]>([])
  const [friends, setFriends] = useState<any[]>([])
  const [manualUsername, setManualUsername] = useState("")
  const [loadingInvite, setLoadingInvite] = useState<string | null>(null)
  const [inviteError, setInviteError] = useState("")
  const [inviteSuccess, setInviteSuccess] = useState("")

  useEffect(() => {
    fetch("/api/friends").then(r => r.json()).then(d => setFriends(d.friends || []))
    fetchSyncs()
  }, [])

  async function fetchSyncs() {
    const res = await fetch("/api/meal-plan-collaborators")
    const data = await res.json()
    setSyncs(data.syncs || [])
  }

  async function inviteByUsername(username: string) {
    setInviteError("")
    setInviteSuccess("")
    setLoadingInvite(username)
    const res = await fetch("/api/meal-plan-collaborators", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username }),
    })
    const data = await res.json()
    if (data.error) {
      setInviteError(data.error)
    } else {
      setInviteSuccess(`Invite sent to ${username}!`)
      fetchSyncs()
    }
    setLoadingInvite(null)
  }

  async function removeSync(syncId: number) {
    await fetch("/api/meal-plan-collaborators", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sync_id: syncId }),
    })
    fetchSyncs()
    onSyncChange()
  }

  const syncedPartnerIds = syncs.map((s: any) => s.partner.id)
  const uninvitedFriends = friends.filter((f: any) => !syncedPartnerIds.includes(f.id))

  return (
    <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl w-full max-w-sm mx-4 max-h-[90vh] overflow-y-auto">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-medium">Plan meals together</h2>
            <p className="text-xs text-gray-400">Invite a friend to see each other's meals in the planner</p>
          </div>
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
                        <img src={friend.profile_image} className="w-8 h-8 rounded-full object-cover" />
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
                      {loadingInvite === friend.username ? "Sending..." : "Invite"}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="mb-4">
            <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">Invite by username</p>
            <div className="flex gap-2">
              <input
                value={manualUsername}
                onChange={e => setManualUsername(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter" && manualUsername.trim()) { inviteByUsername(manualUsername.trim()); setManualUsername("") } }}
                placeholder="username"
                className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none"
              />
              <button
                onClick={() => { if (manualUsername.trim()) { inviteByUsername(manualUsername.trim()); setManualUsername("") } }}
                className="px-4 py-2 bg-orange-500 text-white rounded-lg text-sm font-medium hover:bg-orange-600">
                Invite
              </button>
            </div>
            {inviteError && <p className="text-xs text-red-500 mt-1">{inviteError}</p>}
            {inviteSuccess && <p className="text-xs text-green-600 mt-1">{inviteSuccess}</p>}
          </div>

          {syncs.length > 0 && (
            <div>
              <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-3">Synced with</p>
              <div className="space-y-2">
                {syncs.map((s: any) => (
                  <div key={s.id} className="flex items-center justify-between py-2 border-b border-gray-50">
                    <div className="flex items-center gap-2">
                      {s.partner.profile_image ? (
                        <img src={s.partner.profile_image} className="w-7 h-7 rounded-full object-cover" />
                      ) : (
                        <div className="w-7 h-7 rounded-full bg-orange-500 flex items-center justify-center text-white text-xs">
                          {s.partner.name?.charAt(0)}
                        </div>
                      )}
                      <div>
                        <div className="text-sm font-medium">{s.partner.name}</div>
                        <div className="text-xs text-gray-400">
                          @{s.partner.username} · {s.status === "pending" ? <><ClockIcon size={10} className="inline -mt-0.5" /> Pending</> : s.status === "accepted" ? "✓ Synced" : "✗ Declined"}
                        </div>
                      </div>
                    </div>
                    <button onClick={() => removeSync(s.id)} className="text-xs text-red-400 hover:text-red-600">
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {uninvitedFriends.length === 0 && syncs.length === 0 && (
            <p className="text-sm text-gray-400 text-center py-4">Follow people and have them follow you back to sync meal plans.</p>
          )}
        </div>
      </div>
    </div>
  )
}
