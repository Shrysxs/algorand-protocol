import { NextRequest, NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import path from "path";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const allowed = [
      "video/mp4", "video/webm", "video/quicktime",
      "image/png", "image/jpeg", "image/gif",
    ];
    if (!allowed.includes(file.type)) {
      return NextResponse.json(
        { error: `File type ${file.type} not allowed.` },
        { status: 400 }
      );
    }

    if (file.size > 52428800) {
      return NextResponse.json({ error: "File too large. Max 50MB." }, { status: 400 });
    }

    // Try Supabase Storage first
    try {
      const { getServiceSupabase } = await import("../../../lib/supabase");
      const sb = getServiceSupabase();

      const ext = file.name.split(".").pop() ?? "mp4";
      const fileName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const storagePath = `campaigns/${fileName}`;

      const arrayBuffer = await file.arrayBuffer();
      const { data, error } = await sb.storage
        .from("ad-creatives")
        .upload(storagePath, arrayBuffer, {
          contentType: file.type,
          upsert: false,
        });

      if (!error && data) {
        const { data: urlData } = sb.storage
          .from("ad-creatives")
          .getPublicUrl(data.path);

        // Also save URL to campaigns table
        await sb
          .from("campaigns")
          .update({ ad_creative_url: urlData.publicUrl })
          .eq("app_id", Number(process.env.CAMPAIGN_APP_ID ?? "0"))
          .then(() => {});

        return NextResponse.json({
          url: urlData.publicUrl,
          path: data.path,
          size: file.size,
          type: file.type,
          storage: "supabase",
        });
      }
      // If Supabase storage fails, fall through to local
    } catch {
      // Supabase not configured or bucket doesn't exist — fall through
    }

    // Fallback: save to public/ folder locally
    const ext = file.name.split(".").pop() ?? "png";
    const fileName = `ad-creative-${Date.now()}.${ext}`;
    const uploadsDir = path.join(process.cwd(), "public", "uploads");
    await mkdir(uploadsDir, { recursive: true });

    const buffer = Buffer.from(await file.arrayBuffer());
    const filePath = path.join(uploadsDir, fileName);
    await writeFile(filePath, buffer);

    const publicUrl = `/uploads/${fileName}`;

    // Save to campaigns table if possible
    try {
      const { getServiceSupabase } = await import("../../../lib/supabase");
      const sb = getServiceSupabase();
      await sb
        .from("campaigns")
        .update({ ad_creative_url: publicUrl })
        .eq("app_id", Number(process.env.CAMPAIGN_APP_ID ?? "0"));
    } catch {
      // best effort
    }

    return NextResponse.json({
      url: publicUrl,
      size: file.size,
      type: file.type,
      storage: "local",
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Upload failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
