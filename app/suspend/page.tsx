import Link from "next/link"
import Image from "next/image"

export default function SuspendedPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="bg-white p-10 rounded-2xl border border-gray-100 w-full max-w-md text-center">
        <div className="flex justify-center mb-4">
          <Image src="/logo.svg" alt="SmartFlavr" width={60} height={60}/>
        </div>
        <h1 className="text-xl font-medium mb-2 text-orange-500">Account Suspended</h1>
        <p className="text-sm text-gray-400 mb-6">Your account has been temporarily suspended from SmartFlavr.</p>
        <p className="text-xs text-gray-400">If you believe this is a mistake please contact support.</p>
      </div>
    </div>
  )
}