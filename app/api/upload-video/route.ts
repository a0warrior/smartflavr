import { NextResponse } from "next/server"
import { v2 as cloudinary } from "cloudinary"
import { auth } from "@/auth"

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
})

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  try {
    const { video } = await req.json()
    const result = await cloudinary.uploader.upload(video, {
      folder: "smartflavr/videos",
      resource_type: "video",
    })
    return NextResponse.json({ success: true, url: result.secure_url })
  } catch (error) {
    return NextResponse.json({ success: false, error: String(error) })
  }
}
