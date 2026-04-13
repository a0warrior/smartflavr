"use client"
import { useEffect, useState } from "react"
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

function Avatar({ image, name, size = "sm" }: { image?: string, name?: string, size?: "sm" | "md" }) {
  const sz = size === "sm" ? "w-8 h-8 text-sm" : "w-10 h-10 text-base"
  return image ? (
    <img src={image} className={`${sz} rounded-full object-cover flex-shrink-0`}/>
  ) : (
    <div className={`${sz} rounded-full bg-orange-500 flex items-center justify-center text-white font-medium flex-shrink-0`}>
      {name?.charAt(0).toUpperCase()}
    </div>
  )
}

function PostCard({ post, currentUserId, onDelete }: any) {
  const [showComments, setShowComments] = useState(false)
  const [comments, setComments] = useState<any[]>([])
  const [newComment, setNewComment] = useState("")
  const [liked, setLiked] = useState(post.liked_by_me === 1)
  const [likeCount, setLikeCount] = useState(Number(post.like_count))
  const [commentCount, setCommentCount] = useState(Number(post.comment_count))
  const [loadingComments, setLoadingComments] = useState(false)

  async function toggleLike() {
    const res = await fetch("/api/posts/like", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ post_id: post.id }),
    })
    const data = await res.json()
    setLiked(data.liked)
    setLikeCount((prev: number) => data.liked ? prev + 1 : prev - 1)
  }

  async function loadComments() {
    if (showComments) {
      setShowComments(false)
      return
    }
    setLoadingComments(true)
    const res = await fetch(`/api/posts/comment?post_id=${post.id}`)
    const data = await res.json()
    setComments(data.comments || [])
    setShowComments(true)
    setLoadingComments(false)
  }

  async function submitComment() {
    if (!newComment.trim()) return
    await fetch("/api/posts/comment", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ post_id: post.id, content: newComment }),
    })
    setNewComment("")
    setCommentCount((prev: number) => prev + 1)
    const res = await fetch(`/api/posts/comment?post_id=${post.id}`)
    const data = await res.json()
    setComments(data.comments || [])
  }

  async function deleteComment(id: string) {
    await fetch("/api/posts/comment", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    })
    setCommentCount((prev: number) => prev - 1)
    setComments((prev: any) => prev.filter((c: any) => c.id !== id))
  }

  return (
    <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden">
      <div className="p-4">
        <div className="flex items-start justify-between mb-3">
          <Link href={`/u/${post.author_username}`} className="flex items-center gap-3">
            <Avatar image={post.author_image} name={post.author_name} size="md"/>
            <div>
              <div className="text-sm font-medium text-gray-900">{post.author_name}</div>
              <div className="text-xs text-gray-400">@{post.author_username} · {timeAgo(post.created_at)}</div>
            </div>
          </Link>
          {post.user_id === currentUserId && (
            <button
              onClick={() => onDelete(post.id)}
              className="text-xs text-gray-300 hover:text-red-400 transition">
              ✕
            </button>
          )}
        </div>

        {post.content && (
          <p className="text-sm text-gray-800 leading-relaxed mb-3 whitespace-pre-wrap">{post.content}</p>
        )}

        {post.type === "photo" && post.image_url && (
  <div className="rounded-xl overflow-hidden mb-3">
    <img src={post.image_url} className="w-full object-contain rounded-xl"/>
  </div>
)}

        {post.type === "recipe" && post.recipe_id && (
            <Link href={`/share/cookbook/${post.cookbook_id}`} className="block border border-gray-100 rounded-xl overflow-hidden mb-3 hover:shadow-sm transition">
                {post.image_url ? (
                <img src={post.image_url} className="w-full object-contain rounded-t-xl"/>
                ) : post.recipe_image ? (
                <img src={post.recipe_image} className="w-full object-contain rounded-t-xl"/>
                ) : null}
            <div className="p-3">
              <div className="text-xs font-medium text-orange-500 mb-1">Recipe</div>
              <div className="text-sm font-medium text-gray-900">{post.recipe_title}</div>
              {post.recipe_description && (
                <div className="text-xs text-gray-500 mt-1 line-clamp-2">{post.recipe_description}</div>
              )}
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
              {post.cookbook_cover ? (
                <img src={post.cookbook_cover} className="w-full h-full object-cover"/>
              ) : (
                <span className="text-4xl">{post.cookbook_emoji}</span>
              )}
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

        <div className="flex items-center gap-4 pt-2 border-t border-gray-50">
          <button
            onClick={toggleLike}
            className={`flex items-center gap-1.5 text-xs transition ${liked ? "text-red-500" : "text-gray-400 hover:text-red-400"}`}>
            <span>{liked ? "❤️" : "🤍"}</span>
            <span>{likeCount}</span>
          </button>
          <button
            onClick={loadComments}
            className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-orange-500 transition">
            <span>💬</span>
            <span>{commentCount}</span>
          </button>
        </div>
      </div>

      {showComments && (
        <div className="border-t border-gray-50 px-4 pb-4">
          {loadingComments ? (
            <div className="text-xs text-gray-400 py-3">Loading...</div>
          ) : (
            <>
              <div className="space-y-3 mt-3">
                {comments.map((comment: any) => (
                  <div key={comment.id} className="flex items-start gap-2">
                    <Avatar image={comment.author_image} name={comment.author_name}/>
                    <div className="flex-1 bg-gray-50 rounded-xl px-3 py-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-gray-900">{comment.author_name}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-gray-400">{timeAgo(comment.created_at)}</span>
                          {comment.user_id === currentUserId && (
                            <button onClick={() => deleteComment(comment.id)} className="text-xs text-gray-300 hover:text-red-400">✕</button>
                          )}
                        </div>
                      </div>
                      <p className="text-xs text-gray-700 mt-0.5">{comment.content}</p>
                    </div>
                  </div>
                ))}
              </div>
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
                  className="px-3 py-2 bg-orange-500 text-white rounded-xl text-xs font-medium hover:bg-orange-600 disabled:opacity-50">
                  Post
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}

export default function FeedPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [posts, setPosts] = useState([])
  const [feedType, setFeedType] = useState<"following" | "global">("following")
  const [currentUserId, setCurrentUserId] = useState<number | null>(null)
  const [showPostModal, setShowPostModal] = useState(false)
  const [postType, setPostType] = useState<"text" | "photo" | "recipe" | "cookbook" | "question">("text")
  const [postContent, setPostContent] = useState("")
  const [postImage, setPostImage] = useState("")
  const [postRecipeId, setPostRecipeId] = useState("")
  const [postCookbookId, setPostCookbookId] = useState("")
  const [myCookbooks, setMyCookbooks] = useState([])
  const [myRecipes, setMyRecipes] = useState([])
  const [uploading, setUploading] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login?code=returning")
    if (status === "authenticated") {
      fetchProfile()
      fetchPosts()
      fetchMyCookbooks()
    }
  }, [status])

  useEffect(() => {
    fetchPosts()
  }, [feedType])

  async function fetchProfile() {
    const res = await fetch("/api/profile")
    const data = await res.json()
    if (data.user) setCurrentUserId(data.user.id)
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
        type: postType,
        content: postContent,
        image_url: postImage,
        recipe_id: postRecipeId || null,
        cookbook_id: postCookbookId || null,
      }),
    })
    setPostContent("")
    setPostImage("")
    setPostRecipeId("")
    setPostCookbookId("")
    setPostType("text")
    setShowPostModal(false)
    setSubmitting(false)
    fetchPosts()
  }

  async function deletePost(id: string) {
    if (!confirm("Delete this post?")) return
    await fetch("/api/posts", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    })
    fetchPosts()
  }

  if (status === "loading") {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <div className="max-w-2xl mx-auto px-6 py-8">

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
            onClick={() => setShowPostModal(true)}
            className="bg-orange-500 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-orange-600 transition">
            + New Post
          </button>
        </div>

        <div className="space-y-4">
          {posts.length === 0 ? (
            <div className="text-center py-16">
              <p className="text-4xl mb-3">🍽️</p>
              <p className="text-sm text-gray-400 mb-2">
                {feedType === "following" ? "No posts from people you follow yet" : "No posts yet"}
              </p>
              {feedType === "following" && (
                <p className="text-xs text-gray-400">
                  <Link href="/explore" className="text-orange-500">Find people to follow →</Link>
                </p>
              )}
            </div>
          ) : (
            posts.map((post: any) => (
              <PostCard
                key={post.id}
                post={post}
                currentUserId={currentUserId}
                onDelete={deletePost}
              />
            ))
          )}
        </div>
      </div>

      {showPostModal && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md mx-4 max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg font-medium mb-4">New Post</h2>

            <div className="flex gap-2 mb-4 flex-wrap">
              {(["text", "photo", "recipe", "cookbook", "question"] as const).map(t => (
                <button
                  key={t}
                  onClick={() => {
                    setPostType(t)
                    setPostImage("")
                    setPostRecipeId("")
                    setPostCookbookId("")
                  }}
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
                  postType === "text" ? "What's cooking? Share a thought or update..."
                  : postType === "photo" ? "Add a caption..."
                  : postType === "recipe" ? "Say something about this recipe..."
                  : postType === "cookbook" ? "Tell people about this cookbook..."
                  : "Ask the community a cooking question..."
                }
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm resize-none outline-none"
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
                  {postImage ? (
                    <img src={postImage} className="w-full h-full object-cover"/>
                  ) : (
                    <span className="text-xs text-gray-400">{uploading ? "Uploading..." : "📷 Click to add photo"}</span>
                  )}
                </div>
                <input type="file" id="post-image-upload" accept="image/*" onChange={uploadImage} className="hidden"/>
                {postImage && (
                  <button onClick={() => setPostImage("")} className="text-xs text-red-400 mt-1">Remove photo</button>
                )}
              </div>
            )}

            {(postType === "recipe" || postType === "cookbook") && (
              <div className="mb-4">
                <label className="text-sm text-gray-500 mb-1 block">Select cookbook</label>
                <select
                  value={postCookbookId}
                  onChange={e => {
                    setPostCookbookId(e.target.value)
                    if (postType === "recipe" && e.target.value) {
                      fetchRecipesForCookbook(e.target.value)
                    }
                  }}
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
                      {myRecipes.map((r: any) => (
                        <option key={r.id} value={r.id}>{r.title}</option>
                      ))}
                    </select>
                    <label className="text-sm text-gray-500 mb-1 block">Photo (optional)</label>
                    <div
                      onClick={() => document.getElementById("recipe-post-image-upload")?.click()}
                      className="border-2 border-dashed border-gray-100 rounded-xl h-32 flex items-center justify-center cursor-pointer hover:bg-gray-50 overflow-hidden">
                      {postImage ? (
                        <img src={postImage} className="w-full h-full object-cover"/>
                      ) : (
                        <span className="text-xs text-gray-400">{uploading ? "Uploading..." : "📷 Add a photo"}</span>
                      )}
                    </div>
                    <input type="file" id="recipe-post-image-upload" accept="image/*" onChange={uploadImage} className="hidden"/>
                    {postImage && (
                      <button onClick={() => setPostImage("")} className="text-xs text-red-400 mt-1">Remove photo</button>
                    )}
                  </>
                )}
                {postType === "cookbook" && !myCookbooks.some((b: any) => b.is_public === 1) && (
                  <p className="text-xs text-gray-400 mt-1">You need at least one public cookbook to share.</p>
                )}
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowPostModal(false)
                  setPostContent("")
                  setPostImage("")
                  setPostRecipeId("")
                  setPostCookbookId("")
                  setPostType("text")
                }}
                className="flex-1 border border-gray-200 rounded-xl py-2 text-sm text-gray-500 hover:bg-gray-50">
                Cancel
              </button>
              <button
                onClick={submitPost}
                disabled={submitting || (!postContent && !postImage && !postRecipeId && !postCookbookId)}
                className="flex-1 bg-orange-500 text-white rounded-xl py-2 text-sm font-medium hover:bg-orange-600 disabled:opacity-50">
                {submitting ? "Posting..." : "Post"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}