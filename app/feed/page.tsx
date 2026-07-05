"use client"
import { useEffect, useRef, useState, useCallback } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import Navbar from "@/app/components/Navbar"
import Link from "next/link"
import { WarningIcon, PeopleIcon, CheckIcon, ClockIcon, HeartIcon, UserIcon, QuestionIcon, PlateIcon, BookIcon, CameraIcon, PencilIcon, GlobeIcon, TrashIcon } from "@/app/components/Icons"
import { pulse, subscribe, subscribeConnected } from "@/lib/firebase"
import { PageSkeleton } from "@/app/components/Skeletons"

function timeAgo(date: string) {
  const seconds = Math.floor((new Date().getTime() - new Date(date).getTime()) / 1000)
  if (seconds < 60) return "just now"
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`
  return `${Math.floor(seconds / 86400)}d ago`
}

function timeUntil(date: string) {
  const ms = new Date(date).getTime() - new Date().getTime()
  if (ms <= 0) return ""
  const mins = Math.ceil(ms / 60000)
  if (mins < 60) return `${mins} minute${mins !== 1 ? "s" : ""}`
  const hrs = Math.ceil(ms / 3600000)
  if (hrs < 24) return `${hrs} hour${hrs !== 1 ? "s" : ""}`
  return `${Math.ceil(ms / 86400000)} days`
}

function Avatar({ image, name, size = "sm" }: { image?: string; name?: string; size?: "sm" | "md" }) {
  const sz = size === "sm" ? "w-8 h-8 text-sm" : "w-10 h-10 text-base"
  return image ? (
    <img src={image} className={`${sz} rounded-full object-cover flex-shrink-0`} />
  ) : (
    <div className={`${sz} rounded-full bg-orange-500 flex items-center justify-center text-white font-medium flex-shrink-0`}>
      {name?.charAt(0).toUpperCase()}
    </div>
  )
}


function CommentIcon({ open }: { open: boolean }) {
  return (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill={open ? "#f97316" : "none"} stroke={open ? "#f97316" : "currentColor"} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
    </svg>
  )
}

function DotsIcon() {
  return (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
      <circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/>
    </svg>
  )
}

function PostCard({ post, currentUserId, isAdmin, isTimedOut, onDelete, onUpdate }: any) {
  const [showComments, setShowComments] = useState(false)
  const [comments, setComments] = useState<any[]>([])
  const [newComment, setNewComment] = useState("")
  const [liked, setLiked] = useState(post.liked_by_me === 1)
  const [likeCount, setLikeCount] = useState(Number(post.like_count))
  const [commentCount, setCommentCount] = useState(Number(post.comment_count))
  const [loadingComments, setLoadingComments] = useState(false)
  const [heartAnim, setHeartAnim] = useState(false)
  const [burstAnim, setBurstAnim] = useState(false)
  const [bubbleAnim, setBubbleAnim] = useState(false)
  const [showMenu, setShowMenu] = useState(false)
  const [editMode, setEditMode] = useState(false)
  const [editContent, setEditContent] = useState(post.content || "")
  const [editImageUrl, setEditImageUrl] = useState(post.image_url || "")
  const [saving, setSaving] = useState(false)
  const [editingCommentId, setEditingCommentId] = useState<number | null>(null)
  const [editCommentText, setEditCommentText] = useState("")
  const [tapHeartVisible, setTapHeartVisible] = useState(false)
  const [warningDismissed, setWarningDismissed] = useState(false)
  const [showTimeoutMenu, setShowTimeoutMenu] = useState(false)
  const [recipeExpanded, setRecipeExpanded] = useState(false)
  const [showCopyModal, setShowCopyModal] = useState(false)
  const [userCookbooks, setUserCookbooks] = useState<any[]>([])
  const [copyLoading, setCopyLoading] = useState(false)
  const [copyDone, setCopyDone] = useState<string | null>(null)
  const lastTap = useRef(0)
  const menuRef = useRef<HTMLDivElement>(null)

  async function openCopyModal() {
    setShowCopyModal(true)
    setCopyDone(null)
    if (userCookbooks.length === 0) {
      const res = await fetch("/api/cookbooks")
      const data = await res.json()
      setUserCookbooks(data.cookbooks || [])
    }
  }

  async function copyRecipe(targetCookbookId: string) {
    setCopyLoading(true)
    await fetch("/api/recipes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        cookbook_id: targetCookbookId,
        title: post.recipe_title,
        description: post.recipe_description,
        ingredients: post.recipe_ingredients,
        instructions: post.recipe_instructions,
        prep_time: post.recipe_prep_time,
        servings: post.recipe_servings,
        difficulty: post.recipe_difficulty,
        notes: post.recipe_notes,
        image_url: post.recipe_image || post.image_url,
        sort_order: 0,
      }),
    })
    const picked = userCookbooks.find((c: any) => c.id === targetCookbookId)
    setCopyDone(picked?.title || "your cookbook")
    setCopyLoading(false)
  }

  // Close menu on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setShowMenu(false)
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [])

  async function toggleLike() {
    const res = await fetch("/api/posts/like", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ post_id: post.id }),
    })
    const data = await res.json()
    setLiked(data.liked)
    setLikeCount((prev: number) => data.liked ? prev + 1 : prev - 1)
    if (data.liked) {
      setHeartAnim(true)
      setBurstAnim(true)
      setTimeout(() => setHeartAnim(false), 400)
      setTimeout(() => setBurstAnim(false), 600)
    }
  }

  function handleImageDoubleTap() {
    const now = Date.now()
    if (now - lastTap.current < 300) {
      if (!liked) {
        toggleLike()
        setTapHeartVisible(true)
        setTimeout(() => setTapHeartVisible(false), 750)
      }
    }
    lastTap.current = now
  }

  async function loadComments() {
    if (showComments) { setShowComments(false); return }
    setBubbleAnim(true)
    setTimeout(() => setBubbleAnim(false), 350)
    setLoadingComments(true)
    const res = await fetch(`/api/posts/comment?post_id=${post.id}`)
    const data = await res.json()
    setComments(data.comments || [])
    setShowComments(true)
    setLoadingComments(false)
  }

  async function submitComment() {
    if (!newComment.trim()) return
    const res = await fetch("/api/posts/comment", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ post_id: post.id, content: newComment }),
    })
    if (!res.ok) return
    setNewComment("")
    setCommentCount((prev: number) => prev + 1)
    const r2 = await fetch(`/api/posts/comment?post_id=${post.id}`)
    const d2 = await r2.json()
    setComments(d2.comments || [])
  }

  async function deleteComment(id: number) {
    await fetch("/api/posts/comment", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    })
    setCommentCount((prev: number) => prev - 1)
    setComments((prev: any[]) => prev.filter((c: any) => c.id !== id))
  }

  async function saveEditComment(id: number) {
    if (!editCommentText.trim()) return
    await fetch("/api/posts/comment", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, content: editCommentText }),
    })
    setComments((prev: any[]) =>
      prev.map((c: any) => c.id === id ? { ...c, content: editCommentText, updated_at: new Date().toISOString() } : c)
    )
    setEditingCommentId(null)
  }

  async function savePost() {
    setSaving(true)
    await fetch("/api/posts", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: post.id, content: editContent, image_url: editImageUrl || null }),
    })
    setSaving(false)
    setEditMode(false)
    onUpdate(post.id, { content: editContent, image_url: editImageUrl, updated_at: new Date().toISOString() })
  }

  const isOwn = post.user_id === currentUserId

  async function setContentWarning(on: boolean) {
    const res = await fetch("/api/posts", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: post.id, content_warning: on }),
    })
    if (res.ok) {
      onUpdate(post.id, { content_warning: on ? 1 : 0 })
    }
    setShowMenu(false)
  }

  async function adminTimeoutUser(minutes: number) {
    await fetch("/api/admin/users", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: post.user_id, timeout_minutes: minutes }),
    })
    setShowTimeoutMenu(false)
    setShowMenu(false)
  }

  const showDots = isOwn || isAdmin

  return (
    <div className="bg-white border border-gray-100 rounded-2xl shadow-sm">
      <div className="p-4">
        {/* Header */}
        <div className="flex items-start justify-between mb-3">
          <Link href={`/u/${post.author_username}`} className="flex items-center gap-3">
            <Avatar image={post.author_image} name={post.author_name} size="md" />
            <div>
              <div className="text-sm font-semibold text-gray-900">{post.author_name}</div>
              <div className="flex items-center gap-1 flex-wrap">
                <span className="text-xs text-gray-400">
                  @{post.author_username} · {timeAgo(post.created_at)}
                </span>
                {post.updated_at && (
                  <span className="text-xs text-gray-400 italic">(edited)</span>
                )}
                {post.content_warning === 1 && (
                  <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full flex items-center gap-1"><WarningIcon size={11} />Warning</span>
                )}
                {post.visibility === "followers" && (
                  <span className="text-xs bg-gray-100 text-gray-400 px-2 py-0.5 rounded-full flex items-center gap-1"><PeopleIcon size={11} />Followers</span>
                )}
              </div>
            </div>
          </Link>
          {showDots && (
            <div className="relative" ref={menuRef}>
              <button
                onClick={() => { setShowMenu(p => !p); setShowTimeoutMenu(false) }}
                className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-50 rounded-lg transition">
                <DotsIcon />
              </button>
              {showMenu && (
                <div className="absolute right-0 top-8 bg-white border border-gray-100 rounded-xl shadow-lg z-20 py-1 w-48 overflow-hidden">
                  {isOwn && (
                    <button
                      onClick={() => { setEditMode(true); setShowMenu(false) }}
                      className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2">
                      <PencilIcon size={14} />Edit post
                    </button>
                  )}
                  {isAdmin && (
                    <>
                      <button
                        onClick={() => setContentWarning(post.content_warning !== 1)}
                        className="w-full text-left px-4 py-2.5 text-sm text-yellow-700 hover:bg-yellow-50">
                        {post.content_warning === 1 ? <><CheckIcon size={14} /> Remove warning</> : <><WarningIcon size={14} /> Add content warning</>}
                      </button>
                      {!isOwn && (
                        <div className="border-t border-gray-50">
                          {showTimeoutMenu ? (
                            <div className="px-4 py-2">
                              <p className="text-xs text-gray-400 mb-2 font-medium">Timeout duration</p>
                              <div className="grid grid-cols-2 gap-1">
                                {([["15 min", 15], ["1 hour", 60], ["24 hours", 1440], ["7 days", 10080]] as [string, number][]).map(([label, mins]) => (
                                  <button key={label} onClick={() => adminTimeoutUser(mins)}
                                    className="px-2 py-1.5 text-xs bg-orange-50 text-orange-600 rounded-lg hover:bg-orange-100 text-left">
                                    {label}
                                  </button>
                                ))}
                              </div>
                              <button onClick={() => setShowTimeoutMenu(false)} className="text-xs text-gray-400 mt-2">Cancel</button>
                            </div>
                          ) : (
                            <button
                              onClick={() => setShowTimeoutMenu(true)}
                              className="w-full text-left px-4 py-2.5 text-sm text-orange-600 hover:bg-orange-50">
                              <ClockIcon size={13} /> Timeout user
                            </button>
                          )}
                        </div>
                      )}
                    </>
                  )}
                  <div className="border-t border-gray-50">
                    <button
                      onClick={() => { onDelete(post.id); setShowMenu(false) }}
                      className="w-full text-left px-4 py-2.5 text-sm text-red-500 hover:bg-red-50 flex items-center gap-2">
                      <TrashIcon size={14} /> {isAdmin && !isOwn ? "Remove post" : "Delete post"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Content warning overlay */}
        {post.content_warning === 1 && !warningDismissed && !editMode && (
          <div className="mb-3 rounded-xl bg-yellow-50 border border-yellow-200 p-4 flex flex-col items-center text-center gap-2">
            <div className="text-yellow-500"><WarningIcon size={24} /></div>
            <p className="text-sm font-medium text-yellow-800">Content Warning</p>
            <p className="text-xs text-yellow-600">This post has been flagged by a moderator. It may contain sensitive content.</p>
            <button
              onClick={() => setWarningDismissed(true)}
              className="mt-1 px-4 py-1.5 bg-yellow-200 hover:bg-yellow-300 text-yellow-900 text-xs font-medium rounded-lg transition">
              Show anyway
            </button>
          </div>
        )}

        {/* Content — edit mode or read mode (hidden behind warning until dismissed) */}
        {(post.content_warning !== 1 || warningDismissed) && (editMode ? (
          <div className="mb-3">
            <textarea
              value={editContent}
              onChange={e => setEditContent(e.target.value)}
              className="w-full border border-orange-200 rounded-xl px-3 py-2 text-sm resize-none outline-none focus:border-orange-400"
              rows={3}
              maxLength={500}
            />
            <p className="text-xs text-gray-400 mb-2">{editContent.length}/500</p>
            {post.type === "photo" && (
              <div className="mb-2">
                {editImageUrl && <img src={editImageUrl} className="w-full rounded-xl mb-1 object-contain max-h-72"/>}
                <button onClick={() => setEditImageUrl("")} className="text-xs text-red-400">Remove photo</button>
              </div>
            )}
            <div className="flex gap-2">
              <button onClick={() => setEditMode(false)} className="flex-1 border border-gray-200 rounded-xl py-1.5 text-sm text-gray-500 hover:bg-gray-50">Cancel</button>
              <button onClick={savePost} disabled={saving} className="flex-1 bg-orange-500 text-white rounded-xl py-1.5 text-sm font-medium hover:bg-orange-600 disabled:opacity-50">
                {saving ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
        ) : (
          <>
            {post.content && (
              <p className="text-sm text-gray-800 leading-relaxed mb-3 whitespace-pre-wrap">{post.content}</p>
            )}
            {post.type === "photo" && post.image_url && (
              <div className="relative rounded-xl overflow-hidden mb-3 cursor-pointer select-none" onClick={handleImageDoubleTap}>
                <img src={post.image_url} className="w-full object-contain rounded-xl" />
                {tapHeartVisible && (
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className="tap-heart text-red-500"><HeartIcon filled size={72} /></div>
                  </div>
                )}
              </div>
            )}
            {post.type === "video" && post.image_url && (
              <div className="rounded-xl overflow-hidden mb-3 bg-black">
                <video src={post.image_url} className="w-full max-h-[480px] object-contain" controls playsInline />
              </div>
            )}
            {post.type === "recipe" && !post.recipe_id && (
              <div className="border border-gray-100 rounded-xl p-4 mb-3 flex items-center gap-3 text-gray-400">
                <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><circle cx="12" cy="12" r="10"/><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01"/></svg>
                <span className="text-xs">This recipe is no longer available.</span>
              </div>
            )}
            {post.type === "recipe" && post.recipe_id && (
              <div className="border border-gray-100 rounded-xl overflow-hidden mb-3">
                {(post.image_url || post.recipe_image) && (
                  <img src={post.image_url || post.recipe_image} className="w-full object-contain" />
                )}
                <div className="p-3">
                  <div className="text-xs font-medium text-orange-500 mb-1">Recipe</div>
                  <div className="text-sm font-medium text-gray-900">{post.recipe_title}</div>
                  {post.recipe_description && <div className="text-xs text-gray-500 mt-1 line-clamp-2">{post.recipe_description}</div>}
                  <div className="flex gap-3 mt-2 text-xs text-gray-400">
                    {post.recipe_prep_time && <span className="flex items-center gap-1"><ClockIcon size={11} />{post.recipe_prep_time}</span>}
                    {post.recipe_servings && <span className="flex items-center gap-1"><UserIcon size={11} />{post.recipe_servings}</span>}
                    {post.recipe_difficulty && <span className="capitalize">{post.recipe_difficulty}</span>}
                  </div>

                  {/* Expanded recipe content */}
                  {recipeExpanded && (
                    <div className="mt-4 border-t border-gray-50 pt-4 space-y-4">
                      {post.recipe_ingredients && (
                        <div>
                          <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Ingredients</div>
                          {post.recipe_ingredients.split("\n").filter(Boolean).map((ing: string, i: number) => (
                            <div key={i} className="flex items-center gap-2.5 py-1.5 border-b border-gray-50 last:border-0">
                              <div className="w-3.5 h-3.5 rounded-full border-2 border-gray-200 flex-shrink-0" />
                              <span className="text-sm text-gray-700">{ing}</span>
                            </div>
                          ))}
                        </div>
                      )}
                      {post.recipe_instructions && (
                        <div>
                          <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Instructions</div>
                          {post.recipe_instructions.split("\n").filter(Boolean).map((step: string, i: number) => (
                            <div key={i} className="flex gap-2.5 mb-3">
                              <div className="w-5 h-5 rounded-full bg-orange-50 text-orange-600 text-xs font-semibold flex items-center justify-center flex-shrink-0 mt-0.5">{i + 1}</div>
                              <p className="text-sm text-gray-700 leading-relaxed">{step}</p>
                            </div>
                          ))}
                        </div>
                      )}
                      {post.recipe_notes && (
                        <div className="bg-amber-50 rounded-lg p-3 text-xs text-amber-800 leading-relaxed">{post.recipe_notes}</div>
                      )}
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-50">
                    <button
                      onClick={() => setRecipeExpanded(v => !v)}
                      className="text-xs font-medium text-orange-500 hover:text-orange-600 transition"
                    >
                      {recipeExpanded ? "See less ↑" : "See more ↓"}
                    </button>
                    <button
                      onClick={openCopyModal}
                      className="text-xs font-medium text-gray-500 hover:text-orange-500 transition flex items-center gap-1"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                      Save to cookbook
                    </button>
                  </div>
                </div>
              </div>
            )}
            {post.type === "cookbook" && !post.cookbook_id && (
              <div className="border border-gray-100 rounded-xl p-4 mb-3 flex items-center gap-3 text-gray-400">
                <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><circle cx="12" cy="12" r="10"/><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01"/></svg>
                <span className="text-xs">This cookbook is no longer available.</span>
              </div>
            )}
            {post.type === "cookbook" && post.cookbook_id && (
              <Link href={`/share/cookbook/${post.cookbook_id}`} className="block border border-gray-100 rounded-xl overflow-hidden mb-3 hover:shadow-sm transition">
                <div className="h-24 flex items-center justify-center"
                  style={{ backgroundColor: post.cookbook_cover ? "transparent" : (post.cookbook_color || "#F97316") + "22" }}>
                  {post.cookbook_cover ? <img src={post.cookbook_cover} className="w-full h-full object-cover" />
                    : <span className="text-4xl">{post.cookbook_emoji}</span>}
                </div>
                <div className="p-3">
                  <div className="text-xs font-medium text-orange-500 mb-1">Cookbook</div>
                  <div className="text-sm font-medium text-gray-900">{post.cookbook_title}</div>
                </div>
              </Link>
            )}
            {post.type === "question" && (
              <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 mb-3">
                <div className="text-xs font-medium text-blue-600 mb-1 flex items-center gap-1"><QuestionIcon size={12} />Question</div>
              </div>
            )}
          </>
        ))}

        {/* Like + Comment buttons */}
        {!editMode && (
          <div className="flex items-center gap-5 pt-2 border-t border-gray-50">
            <button
              onClick={toggleLike}
              className={`flex items-center gap-1.5 transition-colors ${liked ? "text-red-500" : "text-gray-400 hover:text-red-400"}`}>
              <div className={`relative ${heartAnim ? "animate-heart-pop" : ""}`}>
                <HeartIcon filled={liked} size={20} />
                {burstAnim && (
                  <div className="absolute inset-0 pointer-events-none">
                    <div className="burst-particle burst-1"/>
                    <div className="burst-particle burst-2"/>
                    <div className="burst-particle burst-3"/>
                    <div className="burst-particle burst-4"/>
                    <div className="burst-particle burst-5"/>
                    <div className="burst-particle burst-6"/>
                  </div>
                )}
              </div>
              <span className="text-sm font-medium">{likeCount}</span>
            </button>

            <button
              onClick={loadComments}
              className={`flex items-center gap-1.5 transition-colors ${showComments ? "text-orange-500" : "text-gray-400 hover:text-orange-400"}`}>
              <div className={bubbleAnim ? "animate-bubble-pop" : ""}>
                <CommentIcon open={showComments} />
              </div>
              <span className="text-sm font-medium">{commentCount}</span>
            </button>
          </div>
        )}
      </div>

      {/* Comments section */}
      {showComments && (
        <div className="border-t border-gray-50 px-4 pb-4">
          {loadingComments ? (
            <div className="flex items-center gap-2 py-4 text-xs text-gray-400">
              <div className="w-3 h-3 border border-gray-300 border-t-orange-400 rounded-full animate-spin"/>
              Loading...
            </div>
          ) : (
            <>
              <div className="space-y-3 mt-3">
                {comments.map((comment: any) => (
                  <div key={comment.id} className="flex items-start gap-2">
                    <Avatar image={comment.author_image} name={comment.author_name} />
                    <div className="flex-1 bg-gray-50 rounded-xl px-3 py-2">
                      <div className="flex items-center justify-between mb-0.5">
                        <span className="text-xs font-semibold text-gray-900">{comment.author_name}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-gray-400">{timeAgo(comment.created_at)}</span>
                          {comment.updated_at && <span className="text-xs text-gray-400 italic">(edited)</span>}
                          {comment.user_id === currentUserId && editingCommentId !== comment.id && (
                            <div className="flex gap-1">
                              <button
                                onClick={() => { setEditingCommentId(comment.id); setEditCommentText(comment.content) }}
                                className="text-xs text-gray-300 hover:text-blue-400 transition">✎</button>
                              <button onClick={() => deleteComment(comment.id)} className="text-xs text-gray-300 hover:text-red-400 transition">✕</button>
                            </div>
                          )}
                        </div>
                      </div>
                      {editingCommentId === comment.id ? (
                        <div className="mt-1">
                          <input
                            value={editCommentText}
                            onChange={e => setEditCommentText(e.target.value)}
                            onKeyDown={e => { if (e.key === "Enter") saveEditComment(comment.id); if (e.key === "Escape") setEditingCommentId(null) }}
                            className="w-full bg-white border border-orange-200 rounded-lg px-2 py-1 text-xs outline-none focus:border-orange-400"
                            autoFocus
                          />
                          <div className="flex gap-1 mt-1">
                            <button onClick={() => setEditingCommentId(null)} className="text-xs text-gray-400">Cancel</button>
                            <button onClick={() => saveEditComment(comment.id)} className="text-xs text-orange-500 font-medium">Save</button>
                          </div>
                        </div>
                      ) : (
                        <p className="text-xs text-gray-700">{comment.content}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              {isTimedOut ? (
                <p className="text-xs text-orange-500 mt-3 italic">You can&apos;t comment while your posting timeout is active.</p>
              ) : (
                <div className="flex gap-2 mt-3">
                  <input
                    value={newComment}
                    onChange={e => setNewComment(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && submitComment()}
                    placeholder="Add a comment..."
                    className="flex-1 bg-gray-50 border border-gray-100 rounded-xl px-3 py-2 text-xs outline-none focus:border-orange-200"
                  />
                  <button
                    onClick={submitComment}
                    disabled={!newComment.trim()}
                    className="px-3 py-2 bg-orange-500 text-white rounded-xl text-xs font-medium hover:bg-orange-600 disabled:opacity-50 transition">
                    Post
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {showCopyModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/40" onClick={() => setShowCopyModal(false)}>
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-xl p-5" onClick={e => e.stopPropagation()}>
            {copyDone ? (
              <div className="text-center py-4">
                <div className="w-12 h-12 rounded-full bg-green-100 text-green-600 flex items-center justify-center mx-auto mb-3"><CheckIcon size={24} /></div>
                <p className="font-medium text-gray-900">Saved to &ldquo;{copyDone}&rdquo;</p>
                <p className="text-sm text-gray-400 mt-1">Recipe copied to your cookbook</p>
                <button onClick={() => setShowCopyModal(false)} className="mt-5 w-full bg-orange-500 text-white py-2.5 rounded-xl text-sm font-medium hover:bg-orange-600 transition">Done</button>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="font-semibold text-gray-900">Save to my cookbook</h2>
                  <button onClick={() => setShowCopyModal(false)} className="text-gray-400 hover:text-gray-600 text-lg leading-none">✕</button>
                </div>
                {userCookbooks.length === 0 ? (
                  <div className="text-center py-8 text-sm text-gray-400">Loading your cookbooks...</div>
                ) : (
                  <div className="space-y-2 max-h-72 overflow-y-auto">
                    {userCookbooks.map((cb: any) => (
                      <button key={cb.id} onClick={() => copyRecipe(cb.id)} disabled={copyLoading}
                        className="w-full flex items-center gap-3 p-3 rounded-xl border border-gray-100 hover:border-orange-200 hover:bg-orange-50 transition text-left disabled:opacity-50">
                        <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 text-xl overflow-hidden"
                          style={{ backgroundColor: cb.cover_image ? "transparent" : (cb.cover_color || "#F97316") + "22" }}>
                          {cb.cover_image ? <img src={cb.cover_image} className="w-full h-full object-cover" /> : cb.cover_emoji || "📖"}
                        </div>
                        <span className="text-sm font-medium text-gray-800 truncate">{cb.title}</span>
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default function FeedPage() {
  const { status } = useSession()
  const router = useRouter()
  const [posts, setPosts] = useState<any[]>([])
  const [feedType, setFeedType] = useState<"following" | "global">("following")
  const [currentUserId, setCurrentUserId] = useState<number | null>(null)
  const [postTimeoutUntil, setPostTimeoutUntil] = useState<string | null>(null)
  const [showPostModal, setShowPostModal] = useState(false)
  const [postType, setPostType] = useState<"text" | "photo" | "video" | "recipe" | "cookbook" | "question">("text")
  const [postVisibility, setPostVisibility] = useState<"everyone" | "followers">("everyone")
  const [postContent, setPostContent] = useState("")
  const [postImage, setPostImage] = useState("")
  const [postVideo, setPostVideo] = useState("")
  const [postRecipeId, setPostRecipeId] = useState("")
  const [postCookbookId, setPostCookbookId] = useState("")
  const [myCookbooks, setMyCookbooks] = useState([])
  const [myRecipes, setMyRecipes] = useState([])
  const [uploading, setUploading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)
  const [newPostsAvailable, setNewPostsAvailable] = useState(false)
  const [liveConnected, setLiveConnected] = useState(false)
  const suppressNextFeedPulse = useRef(false)

  const isTimedOut = Boolean(postTimeoutUntil && new Date(postTimeoutUntil) > new Date())

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login?code=returning")
    if (status === "authenticated") {
      fetchProfile()
      fetchPosts()
      fetchMyCookbooks()
    }
  }, [status])

  useEffect(() => {
    return subscribe("/updates/feed", () => {
      // Our own post already refreshed the feed — don't show the popup for it
      if (suppressNextFeedPulse.current) {
        suppressNextFeedPulse.current = false
        return
      }
      setNewPostsAvailable(true)
    })
  }, [])

  useEffect(() => {
    return subscribeConnected(setLiveConnected)
  }, [])

  useEffect(() => { fetchPosts() }, [feedType])

  async function fetchProfile() {
    const res = await fetch("/api/profile")
    const data = await res.json()
    if (data.user) {
      setCurrentUserId(data.user.id)
      setPostTimeoutUntil(data.user.post_timeout_until || null)
      setIsAdmin(data.user.is_admin === 1)
    }
  }

  async function fetchPosts() {
    const res = await fetch(`/api/posts?feed=${feedType}`)
    const data = await res.json()
    setPosts(data.posts || [])
  }

  async function fetchMyCookbooks() {
    const res = await fetch("/api/cookbooks")
    const data = await res.json()
    setMyCookbooks(data.cookbooks || [])
  }

  async function fetchRecipesForCookbook(cookbookId: string) {
    const res = await fetch(`/api/recipes?cookbook_id=${cookbookId}`)
    const data = await res.json()
    setMyRecipes(data.recipes || [])
  }

  const handlePostUpdate = useCallback((postId: number, patch: any) => {
    setPosts(prev => prev.map((p: any) => p.id === postId ? { ...p, ...patch } : p))
  }, [])

  async function uploadImage(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    const reader = new FileReader()
    reader.onloadend = async () => {
      const res = await fetch("/api/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: reader.result }),
      })
      const data = await res.json()
      if (data.success) setPostImage(data.url)
      setUploading(false)
    }
    reader.readAsDataURL(file)
  }

  async function uploadVideo(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    const reader = new FileReader()
    reader.onloadend = async () => {
      const res = await fetch("/api/upload-video", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ video: reader.result }),
      })
      const data = await res.json()
      if (data.success) setPostVideo(data.url)
      setUploading(false)
    }
    reader.readAsDataURL(file)
  }

  async function submitPost() {
    if (!postContent && !postImage && !postVideo && !postRecipeId && !postCookbookId) return
    setSubmitting(true)
    await fetch("/api/posts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: postType, content: postContent,
        image_url: postType === "video" ? postVideo : postImage,
        recipe_id: postRecipeId || null,
        cookbook_id: postCookbookId || null, visibility: postVisibility,
      }),
    })
    suppressNextFeedPulse.current = true
    pulse("/updates/feed")
    resetModal()
    setSubmitting(false)
    await fetchPosts()
    window.scrollTo({ top: 0, behavior: "smooth" })
  }

  async function deletePost(id: number) {
    if (!confirm("Delete this post?")) return
    await fetch("/api/posts", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    })
    setPosts(prev => prev.filter((p: any) => p.id !== id))
  }

  function resetModal() {
    setShowPostModal(false)
    setPostContent(""); setPostImage(""); setPostVideo(""); setPostRecipeId(""); setPostCookbookId("")
    setPostType("text"); setPostVisibility("everyone")
  }

  if (status === "loading") {
    return <PageSkeleton />
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      {newPostsAvailable && (
        <div className="fixed top-16 left-0 right-0 flex justify-center z-40 pointer-events-none">
          <button
            onClick={() => { setNewPostsAvailable(false); fetchPosts(); window.scrollTo({ top: 0, behavior: "smooth" }) }}
            className="pointer-events-auto bg-gray-900 text-white text-xs font-medium px-4 py-2 rounded-full shadow-lg flex items-center gap-2 hover:bg-gray-800 transition animate-fade-in">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 19V5M5 12l7-7 7 7"/></svg>
            New posts — tap to refresh
          </button>
        </div>
      )}

      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8">

        {/* Timeout banner */}
        {isTimedOut && postTimeoutUntil && (
          <div className="mb-5 bg-orange-50 border border-orange-200 rounded-2xl px-4 py-3 flex items-start gap-3">
            <div className="text-orange-500 mt-0.5"><ClockIcon size={18} /></div>
            <div>
              <p className="text-sm font-medium text-orange-700">Posting temporarily restricted</p>
              <p className="text-xs text-orange-500 mt-0.5">
                You can read and like posts, but can&apos;t post or comment for another {timeUntil(postTimeoutUntil)}.
              </p>
            </div>
          </div>
        )}

        {/* Feed tabs + New Post */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex flex-col gap-1.5">
            {liveConnected && (
              <span className="flex items-center gap-1 text-xs text-green-500 font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse inline-block" />
                Live
              </span>
            )}
            <div className="flex gap-2">
              <button
                onClick={() => setFeedType("following")}
                className={`px-4 py-2 rounded-xl text-sm font-medium transition ${feedType === "following" ? "bg-orange-500 text-white" : "bg-white border border-gray-200 text-gray-500 hover:bg-gray-50"}`}>
                Following
              </button>
              <button
                onClick={() => setFeedType("global")}
                className={`px-4 py-2 rounded-xl text-sm font-medium transition ${feedType === "global" ? "bg-orange-500 text-white" : "bg-white border border-gray-200 text-gray-500 hover:bg-gray-50"}`}>
                Everyone
              </button>
            </div>
          </div>
          <button
            onClick={() => !isTimedOut && setShowPostModal(true)}
            disabled={isTimedOut}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition ${isTimedOut ? "bg-gray-100 text-gray-400 cursor-not-allowed" : "bg-orange-500 text-white hover:bg-orange-600"}`}>
            {isTimedOut ? <span className="flex items-center gap-1.5"><ClockIcon size={14} />Restricted</span> : "+ New Post"}
          </button>
        </div>

        {/* Posts */}
        <div className="space-y-4">
          {posts.length === 0 ? (
            <div className="text-center py-16">
              <div className="text-gray-300 mb-3 flex justify-center"><PlateIcon size={40} /></div>
              <p className="text-sm text-gray-400 mb-2">
                {feedType === "following" ? "No posts from people you follow yet" : "No posts yet"}
              </p>
              {feedType === "following" && (
                <Link href="/explore" className="text-xs text-orange-500">Find people to follow →</Link>
              )}
            </div>
          ) : (
            posts.map((post: any) => (
              <PostCard
                key={post.id}
                post={post}
                currentUserId={currentUserId}
                isAdmin={isAdmin}
                isTimedOut={isTimedOut}
                onDelete={deletePost}
                onUpdate={handlePostUpdate}
              />
            ))
          )}
        </div>
      </div>

      {/* New Post modal */}
      {showPostModal && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-end sm:items-center justify-center z-50">
          <div className="bg-white rounded-t-3xl sm:rounded-2xl p-6 w-full max-w-md mx-0 sm:mx-4 max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg font-semibold mb-4">New Post</h2>

            <div className="flex gap-2 mb-4 flex-wrap">
              {(["text", "photo", "video", "recipe", "cookbook", "question"] as const).map(t => (
                <button
                  key={t}
                  onClick={() => { setPostType(t); setPostImage(""); setPostVideo(""); setPostRecipeId(""); setPostCookbookId("") }}
                  className={`px-3 py-1 rounded-full text-xs border transition ${postType === t ? "bg-orange-500 text-white border-orange-500" : "border-gray-200 text-gray-500 hover:bg-gray-50"}`}>
                  {t === "text" ? <span className="flex items-center gap-1"><PencilIcon size={12} />Text</span>
                    : t === "photo" ? <span className="flex items-center gap-1"><CameraIcon size={12} />Photo</span>
                    : t === "video" ? <span className="flex items-center gap-1"><svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>Video</span>
                    : t === "recipe" ? <span className="flex items-center gap-1"><PlateIcon size={12} />Recipe</span>
                    : t === "cookbook" ? <span className="flex items-center gap-1"><BookIcon size={12} />Cookbook</span>
                    : <span className="flex items-center gap-1"><QuestionIcon size={12} />Question</span>}
                </button>
              ))}
            </div>

            <div className="mb-4">
              <textarea
                value={postContent}
                onChange={e => setPostContent(e.target.value)}
                placeholder={
                  postType === "text" ? "What's cooking?"
                  : postType === "photo" ? "Add a caption..."
                  : postType === "video" ? "Add a caption..."
                  : postType === "recipe" ? "Say something about this recipe..."
                  : postType === "cookbook" ? "Tell people about this cookbook..."
                  : "Ask the community a cooking question..."
                }
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm resize-none outline-none focus:border-orange-300"
                rows={4}
                maxLength={500}
              />
              <p className="text-xs text-gray-400 mt-1">{postContent.length}/500</p>
            </div>

            {postType === "photo" && (
              <div className="mb-4">
                <div
                  onClick={() => document.getElementById("post-image-upload")?.click()}
                  className="border-2 border-dashed border-gray-100 rounded-xl h-40 flex items-center justify-center cursor-pointer hover:bg-gray-50 overflow-hidden">
                  {postImage ? <img src={postImage} className="w-full h-full object-cover" />
                    : <span className="text-xs text-gray-400 flex items-center gap-1">{uploading ? "Uploading..." : <><CameraIcon size={13} />Click to add photo</>}</span>}
                </div>
                <input type="file" id="post-image-upload" accept="image/*" onChange={uploadImage} className="hidden" />
                {postImage && <button onClick={() => setPostImage("")} className="text-xs text-red-400 mt-1">Remove photo</button>}
              </div>
            )}

            {postType === "video" && (
              <div className="mb-4">
                <div
                  onClick={() => !postVideo && document.getElementById("post-video-upload")?.click()}
                  className="border-2 border-dashed border-gray-100 rounded-xl h-40 flex items-center justify-center cursor-pointer hover:bg-gray-50 overflow-hidden bg-black">
                  {postVideo
                    ? <video src={postVideo} className="w-full h-full object-contain" controls />
                    : <span className="text-xs text-gray-400 flex items-center gap-1.5">
                        {uploading ? "Uploading..." : <><svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" className="text-gray-400"><path d="M8 5v14l11-7z"/></svg>Click to add video</>}
                      </span>}
                </div>
                <input type="file" id="post-video-upload" accept="video/*" onChange={uploadVideo} className="hidden" />
                {postVideo && <button onClick={() => setPostVideo("")} className="text-xs text-red-400 mt-1">Remove video</button>}
                <p className="text-xs text-gray-400 mt-1">Keep videos short — large files may take a moment to upload.</p>
              </div>
            )}

            {(postType === "recipe" || postType === "cookbook") && (
              <div className="mb-4">
                <label className="text-sm text-gray-500 mb-1 block">Select cookbook</label>
                <select
                  value={postCookbookId}
                  onChange={e => { setPostCookbookId(e.target.value); if (postType === "recipe" && e.target.value) fetchRecipesForCookbook(e.target.value) }}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none mb-2">
                  <option value="">Select a cookbook...</option>
                  {(postType === "cookbook" ? myCookbooks.filter((b: any) => b.is_public === 1) : myCookbooks).map((b: any) => (
                    <option key={b.id} value={b.id}>{b.cover_emoji} {b.title}{postType === "recipe" && b.is_public !== 1 ? " (private)" : ""}</option>
                  ))}
                </select>
                {postType === "recipe" && postCookbookId && (
                  <>
                    <label className="text-sm text-gray-500 mb-1 block">Select recipe</label>
                    <select
                      value={postRecipeId}
                      onChange={e => setPostRecipeId(e.target.value)}
                      className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none mb-3">
                      <option value="">Select a recipe...</option>
                      {myRecipes.map((r: any) => <option key={r.id} value={r.id}>{r.title}</option>)}
                    </select>
                  </>
                )}
                {postType === "cookbook" && !myCookbooks.some((b: any) => b.is_public === 1) && (
                  <p className="text-xs text-gray-400 mt-1">You need at least one public cookbook to share.</p>
                )}
              </div>
            )}

            <div className="mb-5">
              <label className="text-sm text-gray-500 mb-2 block">Who can see this?</label>
              <div className="flex gap-3">
                <button onClick={() => setPostVisibility("everyone")}
                  className={`flex-1 py-2 rounded-xl text-sm border transition ${postVisibility === "everyone" ? "bg-orange-500 text-white border-orange-500" : "border-gray-200 text-gray-500 hover:bg-gray-50"}`}>
                  <span className="flex items-center gap-1.5 justify-center"><GlobeIcon size={14} />Everyone</span>
                </button>
                <button onClick={() => setPostVisibility("followers")}
                  className={`flex-1 py-2 rounded-xl text-sm border transition ${postVisibility === "followers" ? "bg-orange-500 text-white border-orange-500" : "border-gray-200 text-gray-500 hover:bg-gray-50"}`}>
                  <span className="flex items-center gap-1.5 justify-center"><PeopleIcon size={14} />Followers only</span>
                </button>
              </div>
            </div>

            <div className="flex gap-3">
              <button onClick={resetModal} className="flex-1 border border-gray-200 rounded-xl py-2.5 text-sm text-gray-500 hover:bg-gray-50">Cancel</button>
              <button
                onClick={submitPost}
                disabled={submitting || (!postContent && !postImage && !postVideo && !postRecipeId && !postCookbookId)}
                className="flex-1 bg-orange-500 text-white rounded-xl py-2.5 text-sm font-semibold hover:bg-orange-600 disabled:opacity-50">
                {submitting ? "Posting..." : "Post"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
