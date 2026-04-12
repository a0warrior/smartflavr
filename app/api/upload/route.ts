import { NextResponse } from "next/server"
import { v2 as cloudinary } from "cloudinary"

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
})

export async function POST(req: Request) {
  try {
    const { image } = await req.json()
    const result = await cloudinary.uploader.upload(image, {
      folder: "smartflavr",
    })
    return NextResponse.json({ success: true, url: result.secure_url })
  } catch (error) {
    return NextResponse.json({ success: false, error: String(error) })
  }
}