const JIGSAWSTACK_API = "https://api.jigsawstack.com/v1/validate/nsfw";

interface NsfwResult {
  success: boolean;
  nsfw: boolean;
  nudity: boolean;
  gore: boolean;
  nsfw_score: number;
  nudity_score: number;
  gore_score: number;
}

export async function checkImageNsfw(imageUrl: string): Promise<{
  safe: boolean;
  reason?: string;
}> {
  const apiKey = process.env.JIGSAWSTACK_API_KEY;
  if (!apiKey) {
    // If no API key configured, allow the image (no moderation)
    return { safe: true };
  }

  try {
    const res = await fetch(JIGSAWSTACK_API, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
      },
      body: JSON.stringify({ url: imageUrl }),
    });

    if (!res.ok) {
      // API error — don't block the user, just log
      console.error(`[moderation] JigsawStack returned ${res.status}`);
      return { safe: true };
    }

    const data = (await res.json()) as NsfwResult;

    if (!data.success) {
      return { safe: true };
    }

    if (data.nsfw || data.nudity || data.gore) {
      const reasons: string[] = [];
      if (data.nudity) reasons.push("çıplaklık");
      if (data.nsfw) reasons.push("uygunsuz içerik");
      if (data.gore) reasons.push("şiddet");
      return {
        safe: false,
        reason: `Görsel reddedildi: ${reasons.join(", ")} tespit edildi.`,
      };
    }

    return { safe: true };
  } catch (err) {
    console.error("[moderation] NSFW check failed:", err);
    // On network error, don't block
    return { safe: true };
  }
}
