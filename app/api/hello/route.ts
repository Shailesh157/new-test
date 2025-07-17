import axios from "axios";
import ffmpeg from "fluent-ffmpeg";
import stream from "stream";
import { promisify } from "util";
import { execSync } from "child_process";
import { createClient } from "@supabase/supabase-js";
import path from "path";

const finished = promisify(stream.finished);

// Set FFmpeg paths
// try {
//   const ffmpegPath = execSync("which ffmpeg").toString().trim();
//   const ffprobePath = execSync("which ffprobe").toString().trim();
//   ffmpeg.setFfmpegPath(ffmpegPath);
//   ffmpeg.setFfprobePath(ffprobePath);
// } catch (err) {
//   console.error("FFmpeg or ffprobe not found in PATH");
// }

const ffmpegPath = path.join(process.cwd(), "public", "ffmpeg", "ffmpeg");
const ffprobePath = path.join(process.cwd(), "public", "ffmpeg", "ffprobe");

ffmpeg.setFfmpegPath(ffmpegPath);
ffmpeg.setFfprobePath(ffprobePath);

const supabase = createClient(
  "https://lttudqwlhtphfvvgfsjl.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx0dHVkcXdsaHRwaGZ2dmdmc2psIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0ODE0OTUxMiwiZXhwIjoyMDYzNzI1NTEyfQ.xS5Om4ang0dFf_WG40V7twnZVD-2x4Y5mqL1DBe-Er4"
);

export async function POST(request: any) {
  try {
    const body = await request.json();
    const { audioUrl1, fileName } = body;

    if (!audioUrl1) {
      return new Response(JSON.stringify({ error: "audioUrl1 is required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // 1. Download audio stream from URL
    const audioResponse = await axios({
      url: audioUrl1,
      method: "GET",
      responseType: "stream",
    });

    // 2. Process the audio in memory using FFmpeg
    const outputStream = new stream.PassThrough();
    const outputBufferChunks: Buffer[] = [];

    outputStream.on("data", (chunk) => outputBufferChunks.push(chunk));

    const ffmpegPromise = new Promise<void>((resolve: any, reject) => {
      ffmpeg(audioResponse.data)
        .format("mp3")
        .on("error", reject)
        .on("end", resolve)
        .pipe(outputStream, { end: true });
    });

    await ffmpegPromise;
    await finished(outputStream);

    const finalBuffer = Buffer.concat(outputBufferChunks);

    // 3. Upload to Supabase
    const { data, error } = await supabase.storage
      .from("custom-story-audio")
      .upload(fileName, finalBuffer, {
        contentType: "audio/mpeg",
        upsert: true,
      });

    // getPublicUrl does not return an error property, only data
    if (!data || !data.path) {
      return new Response(JSON.stringify({ error: "Audio upload failed." }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    const { data: urlData } = supabase.storage
      .from("custom-story-audio")
      .getPublicUrl(data.path);

    if (!urlData || !urlData.publicUrl) {
      return new Response(
        JSON.stringify({ error: `Audio processing failed3.${error}` }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" },
        }
      );
    }
    console.log(">_< ~ POST ~ urlData:", urlData);

    if (error) throw error;

    return new Response(JSON.stringify({ ok: true, url: urlData }), {
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": "attachment; filename=output.mp3",
      },
    });
  } catch (error) {
    console.error("Audio processing failed2:", error);
    return new Response(
      JSON.stringify({ error: `Audio processing failed3.${error}` }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}
