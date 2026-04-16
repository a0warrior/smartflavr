"use client"
import { useEffect, useState } from "react"
import { useSession } from "next-auth/react"
import { useRouter, useParams } from "next/navigation"
import Link from "next/link"

type LessonContent = {
  intro: string
  steps: { title: string; content: string }[]
  tip: string
  quiz: { question: string; options: string[]; correct: number }[]
}

export default function LessonPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const params = useParams()
  const [track, setTrack] = useState<any>(null)
  const [lesson, setLesson] = useState<any>(null)
  const [content, setContent] = useState<LessonContent | null>(null)
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [completedIds, setCompletedIds] = useState<Set<number>>(new Set())

  const [phase, setPhase] = useState<"intro" | "steps" | "tip" | "quiz" | "complete">("intro")
  const [stepIndex, setStepIndex] = useState(0)
  const [quizIndex, setQuizIndex] = useState(0)
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null)
  const [answered, setAnswered] = useState(false)
  const [correctCount, setCorrectCount] = useState(0)
  const [earnedXp, setEarnedXp] = useState(0)
  const [alreadyCompleted, setAlreadyCompleted] = useState(false)

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login")
    if (status === "authenticated") fetchData()
  }, [status])

  async function fetchData() {
    setLoading(true)
    const res = await fetch("/api/learn")
    const data = await res.json()
    const foundTrack = (data.tracks || []).find((t: any) => t.slug === params.trackSlug)
    if (!foundTrack) { router.push("/learn"); return }
    const foundLesson = foundTrack.lessons?.find((l: any) => l.id === parseInt(params.lessonId as string))
    if (!foundLesson) { router.push(`/learn/${params.trackSlug}`); return }
    setTrack(foundTrack)
    setLesson(foundLesson)
    const ids = new Set<number>(data.completedLessonIds || [])
    setCompletedIds(ids)
    setAlreadyCompleted(ids.has(foundLesson.id))
    setLoading(false)
    generateContent(foundLesson, foundTrack)
  }

  async function generateContent(l: any, t: any) {
    setGenerating(true)
    const res = await fetch("/api/learn/lesson", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: l.title, description: l.description, trackName: t.name }),
    })
    const data = await res.json()
    if (data.success) setContent(data.lesson)
    setGenerating(false)
  }

  async function completeLesson() {
    if (alreadyCompleted) return
    await fetch("/api/learn/complete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lesson_id: lesson.id, xp: lesson.xp }),
    })
  }

  function progressPct() {
    if (!content) return 0
    const total = 1 + content.steps.length + 1 + content.quiz.length + 1
    let done = 0
    if (phase === "steps") done = 1 + stepIndex
    if (phase === "tip") done = 1 + content.steps.length
    if (phase === "quiz") done = 1 + content.steps.length + 1 + quizIndex
    if (phase === "complete") done = total
    return Math.round((done / total) * 100)
  }

  function handleAnswer(idx: number) {
    if (answered) return
    setSelectedAnswer(idx)
    setAnswered(true)
    if (idx === content!.quiz[quizIndex].correct) {
      setCorrectCount(prev => prev + 1)
    }
  }

  async function handleNext() {
    if (!content) return

    if (phase === "intro") {
      setPhase("steps")
      setStepIndex(0)
    } else if (phase === "steps") {
      if (stepIndex < content.steps.length - 1) {
        setStepIndex(stepIndex + 1)
      } else {
        setPhase("tip")
      }
    } else if (phase === "tip") {
      setPhase("quiz")
      setQuizIndex(0)
      setSelectedAnswer(null)
      setAnswered(false)
    } else if (phase === "quiz") {
      if (quizIndex < content.quiz.length - 1) {
        setQuizIndex(quizIndex + 1)
        setSelectedAnswer(null)
        setAnswered(false)
      } else {
        const xp = alreadyCompleted ? 0 : lesson.xp
        setEarnedXp(xp)
        await completeLesson()
        setPhase("complete")
      }
    }
  }

  const nextLesson = track?.lessons?.find((l: any) => {
    const idx = track.lessons.findIndex((x: any) => x.id === lesson?.id)
    return track.lessons.indexOf(l) === idx + 1
  })

  if (status === "loading" || loading) {
    return <div className="min-h-screen bg-gray-50 flex items-center justify-center"><p className="text-sm text-gray-400">Loading...</p></div>
  }

  if (generating || !content) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center gap-4">
        <div className="text-4xl">👨‍🍳</div>
        <p className="text-base font-medium text-gray-700">Preparing your lesson...</p>
        <p className="text-sm text-gray-400">AI is generating content just for you</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-100 px-6 py-3 flex items-center gap-4">
        <Link href={`/learn/${params.trackSlug}`} className="text-sm text-gray-400 hover:text-gray-600 transition flex-shrink-0">
          ← {track?.name}
        </Link>
        <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
          <div
            className="h-2 bg-orange-400 rounded-full transition-all duration-500"
            style={{ width: `${progressPct()}%` }}/>
        </div>
        <span className="text-xs font-medium text-orange-500 flex-shrink-0">+{lesson?.xp} XP</span>
      </div>

      <div className="max-w-xl mx-auto px-6 py-10">

        {phase === "intro" && (
          <>
            <div className="flex items-center gap-2 mb-6">
              <span className="text-2xl">{track?.emoji}</span>
              <div>
                <div className="text-xs text-gray-400">{track?.name}</div>
                <h1 className="text-xl font-medium text-gray-900">{lesson?.title}</h1>
              </div>
            </div>
            <div className="bg-white border border-gray-100 rounded-2xl p-5 mb-4">
              <p className="text-sm text-gray-700 leading-relaxed">{content.intro}</p>
            </div>
            <div className="text-xs text-gray-400 mb-6 text-center">
              {content.steps.length} steps · {content.quiz.length} questions · +{lesson?.xp} XP
            </div>
            <button onClick={handleNext} className="w-full bg-orange-500 text-white rounded-2xl py-4 text-base font-medium hover:bg-orange-600 transition">
              Start lesson →
            </button>
          </>
        )}

        {phase === "steps" && (
          <>
            <div className="flex gap-1.5 mb-6">
              {content.steps.map((_, i) => (
                <div key={i} className={`h-1.5 flex-1 rounded-full transition-all ${i < stepIndex ? "bg-orange-400" : i === stepIndex ? "bg-orange-400" : "bg-gray-200"}`}/>
              ))}
            </div>
            <div className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-3">
              Step {stepIndex + 1} of {content.steps.length}
            </div>
            <div className="bg-white border border-gray-100 rounded-2xl p-5 mb-4">
              <h2 className="text-lg font-medium text-gray-900 mb-3">{content.steps[stepIndex].title}</h2>
              <p className="text-sm text-gray-600 leading-relaxed">{content.steps[stepIndex].content}</p>
            </div>
            <button onClick={handleNext} className="w-full bg-orange-500 text-white rounded-2xl py-4 text-base font-medium hover:bg-orange-600 transition">
              {stepIndex < content.steps.length - 1 ? "Next step →" : "Continue →"}
            </button>
          </>
        )}

        {phase === "tip" && (
          <>
            <div className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-3">Pro tip</div>
            <div className="bg-amber-50 border border-amber-100 rounded-2xl p-5 mb-4">
              <div className="text-2xl mb-3">💡</div>
              <p className="text-sm text-amber-800 leading-relaxed">{content.tip}</p>
            </div>
            <button onClick={handleNext} className="w-full bg-orange-500 text-white rounded-2xl py-4 text-base font-medium hover:bg-orange-600 transition">
              Got it →
            </button>
          </>
        )}

        {phase === "quiz" && (
          <>
            <div className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-3">
              Question {quizIndex + 1} of {content.quiz.length}
            </div>
            <div className="bg-white border border-gray-100 rounded-2xl p-5 mb-4">
              <h2 className="text-base font-medium text-gray-900 mb-4">{content.quiz[quizIndex].question}</h2>
              <div className="flex flex-col gap-2">
                {content.quiz[quizIndex].options.map((opt, i) => {
                  let cls = "w-full text-left border rounded-xl px-4 py-3 text-sm transition "
                  if (!answered) {
                    cls += "border-gray-200 text-gray-700 hover:border-orange-300 hover:bg-orange-50 cursor-pointer"
                  } else if (i === content.quiz[quizIndex].correct) {
                    cls += "border-green-400 bg-green-50 text-green-800 cursor-default"
                  } else if (i === selectedAnswer && i !== content.quiz[quizIndex].correct) {
                    cls += "border-red-300 bg-red-50 text-red-700 cursor-default"
                  } else {
                    cls += "border-gray-100 text-gray-400 cursor-default"
                  }
                  return (
                    <button key={i} className={cls} onClick={() => handleAnswer(i)} disabled={answered}>
                      {opt}
                    </button>
                  )
                })}
              </div>
              {answered && (
                <div className={`mt-4 p-3 rounded-xl text-sm ${selectedAnswer === content.quiz[quizIndex].correct ? "bg-green-50 text-green-800" : "bg-red-50 text-red-700"}`}>
                  {selectedAnswer === content.quiz[quizIndex].correct
                    ? "✓ Correct! Great job."
                    : `✗ Not quite — the correct answer is: "${content.quiz[quizIndex].options[content.quiz[quizIndex].correct]}"`
                  }
                </div>
              )}
            </div>
            {answered && (
              <button onClick={handleNext} className="w-full bg-orange-500 text-white rounded-2xl py-4 text-base font-medium hover:bg-orange-600 transition">
                {quizIndex < content.quiz.length - 1 ? "Next question →" : "Finish lesson →"}
              </button>
            )}
          </>
        )}

        {phase === "complete" && (
          <div className="text-center py-6">
            <div className="text-6xl mb-4">🎉</div>
            <h1 className="text-2xl font-medium text-gray-900 mb-2">Lesson complete!</h1>
            <p className="text-sm text-gray-400 mb-6">
              {correctCount} of {content.quiz.length} questions correct
              {!alreadyCompleted && <span className="text-orange-500 font-medium"> · +{earnedXp} XP earned</span>}
            </p>
            <div className="bg-orange-50 border border-orange-100 rounded-2xl p-5 mb-6 text-left">
              <div className="text-xs font-medium text-orange-500 uppercase tracking-wide mb-2">What you learned</div>
              <div className="text-sm text-gray-700 font-medium mb-1">{lesson?.title}</div>
              <ul className="space-y-1 mt-2">
                {content.steps.map((s, i) => (
                  <li key={i} className="text-xs text-gray-500 flex items-start gap-2">
                    <span className="text-orange-400 flex-shrink-0">✓</span>
                    {s.title}
                  </li>
                ))}
              </ul>
            </div>
            <div className="flex flex-col gap-3">
              {nextLesson && (
                <Link
                  href={`/learn/${params.trackSlug}/${nextLesson.id}`}
                  className="w-full bg-orange-500 text-white rounded-2xl py-4 text-base font-medium hover:bg-orange-600 transition text-center">
                  Next lesson: {nextLesson.title} →
                </Link>
              )}
              <Link
                href={`/learn/${params.trackSlug}`}
                className="w-full border border-gray-200 text-gray-600 rounded-2xl py-3.5 text-sm font-medium hover:bg-gray-50 transition text-center">
                Back to {track?.name}
              </Link>
              <Link
                href="/learn"
                className="w-full border border-gray-200 text-gray-600 rounded-2xl py-3.5 text-sm font-medium hover:bg-gray-50 transition text-center">
                Back to all tracks
              </Link>
            </div>
          </div>
        )}

      </div>
    </div>
  )
}