import { initializeApp, getApps } from "firebase/app"
import { getDatabase, ref, set, onValue } from "firebase/database"

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
}

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0]
const db = getDatabase(app)

// Write a timestamp pulse to a Firebase path to signal that something changed.
// Listeners on that path will refetch from the DB.
export function pulse(path: string) {
  set(ref(db, path), Date.now()).catch(() => {})
}

// Subscribe to a Firebase path. Calls onChange whenever the value updates.
// Returns a cleanup function — call it in useEffect cleanup.
export function subscribe(path: string, onChange: () => void): () => void {
  const r = ref(db, path)
  let first = true
  const unsub = onValue(r, () => {
    if (first) { first = false; return } // skip initial load
    onChange()
  })
  return unsub
}

// Subscribe to Firebase connection state. Calls onChange(true) when connected, onChange(false) when not.
export function subscribeConnected(onChange: (connected: boolean) => void): () => void {
  const r = ref(db, ".info/connected")
  return onValue(r, snap => onChange(snap.val() === true))
}

export { db }
