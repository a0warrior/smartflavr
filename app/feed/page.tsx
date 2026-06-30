"use client"
import { useEffect, useRef, useState, useCallback } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import Navbar from "@/app/components/Navbar"
import Link from "next/link"

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

function HeartIcon({ filled }: { filled: boolean }) {
  return filled ? (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="#ef4444">
      <path d="M12 21.593c-.52-.462-8.592-7.11-8.592-12.177C3.408 5.853 6.058 3 9.207 3c1.777 0 3.375.98 4.293 2.467A5.024 5.024 0 0117.292 3C20.442 3 23.09 5.853 23.09 9.416c0 5.067-8.07 11.715-8.59 12.177L12 21.593z"/>
    </svg>
  ) : (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
    </svg>
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
  const lastTap = useRef(0)
  const menuRef = useRef<HTMLDivElement>(null)

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
    <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden shadow-sm">
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
                  <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full">⚠️ Warning</span>
                )}
                {post.visibility === "followers" && (
                  <span className="text-xs bg-gray-100 text-gray-400 px-2 py-0.5 rounded-full">👥 Followers</span>
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
                      className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50">
                      ✏️ Edit post
                    </button>
                  )}
                  {isAdmin && (
                    <>
                      <button
                        onClick={() => setContentWarning(post.content_warning !== 1)}
                        className="w-full text-left px-4 py-2.5 text-sm text-yellow-700 hover:bg-yellow-50">
                        {post.content_warning === 1 ? "✅ Remove warning" : "⚠️ Add content warning"}
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
                              ⏱ Timeout user
                            </button>
                          )}
                        </div>
                      )}
                    </>
                  )}
                  <div className="border-t border-gray-50">
                    <button
                      onClick={() => { onDelete(post.id); setShowMenu(false) }}
                      className="w-full text-left px-4 py-2.5 text-sm text-red-500 hover:bg-red-50">
                      🗑️ {isAdmin && !isOwn ? "Remove post" : "Delete post"}
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
            <span className="text-2xl">⚠️</span>
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
                    <span className="text-7xl tap-heart">❤️</span>
                  </div>
                )}
              </div>
            )}
            {post.type === "recipe" && post.recipe_id && (
              <Link href={`/cookbook/${post.cookbook_id}?recipe=${post.recipe_id}`} className="block border border-gray-100 rounded-xl overflow-hidden mb-3 hover:shadow-sm transition">
                {post.image_url ? <img src={post.image_url} className="w-full object-contain rounded-t-xl" />
                  : post.recipe_image ? <img src={post.recipe_image} className="w-full object-contain rounded-t-xl" />
                  : null}
                <div className="p-3">
                  <div className="text-xs font-medium text-orange-500 mb-1">Recipe</div>
                  <div className="text-sm font-medium text-gray-900">{post.recipe_title}</div>
                  {post.recipe_description && <div className="text-xs text-gray-500 mt-1 line-clamp-2">{post.recipe_description}</div>}
                  <div className="flex gap-3 mt-2 text-xs text-gray-400">
                    {post.recipe_prep_time && <span>⏱ {post.recipe_prep_time}</span>}
                    {post.recipe_servings && <span>👤 {post.recipe_servings}</span>}
                  </div>
                </div>
              </Link>
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
                <div className="text-xs font-medium text-blue-600 mb-1">❓ Question</div>
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
                <HeartIcon filled={liked} />
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
  const [postType, setPostType] = useState<"text" | "photo" | "recipe" | "cookbook" | "question">("text")
  const [postVisibility, setPostVisibility] = useState<"everyone" | "followers">("everyone")
  const [postContent, setPostContent] = useState("")
  const [postImage, setPostImage] = useState("")
  const [postRecipeId, setPostRecipeId] = useState("")
  const [postCookbookId, setPostCookbookId] = useState("")
  const [myCookbooks, setMyCookbooks] = useState([])
  const [myRecipes, setMyRecipes] = useState([])
  const [uploading, setUploading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)

  const isTimedOut = Boolean(postTimeoutUntil && new Date(postTimeoutUntil) > new Date())

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login?code=returning")
    if (status === "authenticated") {
      fetchProfile()
      fetchPosts()
      fetchMyCookbooks()
    }
  }, [status])

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

  async function submitPost() {
    if (!postContent && !postImage && !postRecipeId && !postCookbookId) return
    setSubmitting(true)
    await fetch("/api/posts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: postType, content: postContent,
        image_url: postImage, recipe_id: postRecipeId || null,
        cookbook_id: postCookbookId || null, visibility: postVisibility,
      }),
    })
    resetModal()
    setSubmitting(false)
    fetchPosts()
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
    setPostContent(""); setPostImage(""); setPostRecipeId(""); setPostCookbookId("")
    setPostType("text"); setPostVisibility("everyone")
  }

  if (status === "loading") {
    return <div className="min-h-screen flex items-center justify-center text-sm text-gray-400">Loading...</div>
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8">

        {/* Timeout banner */}
        {isTimedOut && postTimeoutUntil && (
          <div className="mb-5 bg-orange-50 border border-orange-200 rounded-2xl px-4 py-3 flex items-start gap-3">
            <span className="text-lg mt-0.5">⏱</span>
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
          <button
            onClick={() => !isTimedOut && setShowPostModal(true)}
            disabled={isTimedOut}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition ${isTimedOut ? "bg-gray-100 text-gray-400 cursor-not-allowed" : "bg-orange-500 text-white hover:bg-orange-600"}`}>
            {isTimedOut ? "⏱ Restricted" : "+ New Post"}
          </button>
        </div>

        {/* Posts */}
        <div className="space-y-4">
          {posts.length === 0 ? (
            <div className="text-center py-16">
              <p className="text-4xl mb-3">🍽️</p>
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
              {(["text", "photo", "recipe", "cookbook", "question"] as const).map(t => (
                <button
                  key={t}
                  onClick={() => { setPostType(t); setPostImage(""); setPostRecipeId(""); setPostCookbookId("") }}
                  className={`px-3 py-1 rounded-full text-xs border transition ${postType === t ? "bg-orange-500 text-white border-orange-500" : "border-gray-200 text-gray-500 hover:bg-gray-50"}`}>
                  {t === "text" ? "📝 Text" : t === "photo" ? "📷 Photo" : t === "recipe" ? "🍽️ Recipe" : t === "cookbook" ? "📖 Cookbook" : "❓ Question"}
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
                    : <span className="text-xs text-gray-400">{uploading ? "Uploading..." : "📷 Click to add photo"}</span>}
                </div>
                <input type="file" id="post-image-upload" accept="image/*" onChange={uploadImage} className="hidden" />
                {postImage && <button onClick={() => setPostImage("")} className="text-xs text-red-400 mt-1">Remove photo</button>}
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
                  {myCookbooks.filter((b: any) => b.is_public === 1).map((b: any) => (
                    <option key={b.id} value={b.id}>{b.cover_emoji} {b.title}</option>
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
                  🌍 Everyone
                </button>
                <button onClick={() => setPostVisibility("followers")}
                  className={`flex-1 py-2 rounded-xl text-sm border transition ${postVisibility === "followers" ? "bg-orange-500 text-white border-orange-500" : "border-gray-200 text-gray-500 hover:bg-gray-50"}`}>
                  👥 Followers only
                </button>
              </div>
            </div>

            <div className="flex gap-3">
              <button onClick={resetModal} className="flex-1 border border-gray-200 rounded-xl py-2.5 text-sm text-gray-500 hover:bg-gray-50">Cancel</button>
              <button
                onClick={submitPost}
                disabled={submitting || (!postContent && !postImage && !postRecipeId && !postCookbookId)}
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
