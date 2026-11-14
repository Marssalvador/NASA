import argparse
from pathlib import Path

try:
    import torch
except ImportError:  # pragma: no cover
    torch = None

try:
    from diffusers import AutoPipelineForText2Image
except ImportError:  # pragma: no cover
    AutoPipelineForText2Image = None

from PIL import Image, ImageDraw, ImageFilter


def build_prompt(user_prompt: str) -> str:
    prompt = (
        "ultra-detailed 3D anatomical human body, futuristic medical visualization, "
        "translucent blue muscular-skeletal structure, volumetric lighting, clean studio background, "
        "high detail, realistic body proportions, biomedical render, front view, symmetrical composition, "
        "no text, no watermark, cinematic lighting"
    )
    if user_prompt and user_prompt.strip():
        return f"{user_prompt.strip()}, {prompt}"
    return prompt


def generate_placeholder_body(width: int = 1024, height: int = 1024) -> Image.Image:
    image = Image.new("RGBA", (width, height), (5, 18, 30, 255))
    draw = ImageDraw.Draw(image)

    for x in range(0, width, 64):
        draw.line((x, 0, x, height), fill=(70, 120, 160, 50), width=1)
    for y in range(0, height, 64):
        draw.line((0, y, width, y), fill=(70, 120, 160, 50), width=1)

    body_outline = (128, 228, 255, 200)
    muscle_line = (255, 148, 76, 210)
    bone_line = (152, 228, 255, 210)

    # head
    draw.ellipse((420, 80, 604, 265), fill=(105, 195, 255, 120), outline=body_outline, width=3)

    # torso / pelvis silhouette
    torso = [
        (300, 280), (372, 250), (440, 260), (470, 318), (472, 446), (450, 560),
        (468, 700), (450, 820), (500, 875), (530, 820), (550, 700), (578, 448),
        (580, 318), (620, 260), (700, 250), (724, 280), (758, 430), (735, 740),
        (700, 860), (610, 950), (510, 980), (446, 980), (352, 950), (290, 860),
        (248, 740), (220, 430)
    ]
    draw.polygon(torso, fill=(110, 199, 255, 120), outline=body_outline, width=3)

    # shoulder and hip emphasis
    draw.ellipse((250, 280, 770, 420), fill=(96, 182, 245, 75), outline=(144, 220, 255, 180), width=2)
    draw.ellipse((300, 700, 724, 860), fill=(101, 188, 245, 80), outline=(144, 220, 255, 180), width=2)

    # arms
    left_arm = [(240, 300), (180, 360), (164, 510), (185, 680), (252, 786), (308, 744), (288, 540), (310, 394), (298, 326)]
    right_arm = [(784, 300), (844, 360), (860, 510), (840, 680), (775, 786), (718, 744), (735, 540), (714, 394), (726, 326)]
    draw.polygon(left_arm, fill=(110, 198, 255, 110), outline=body_outline, width=3)
    draw.polygon(right_arm, fill=(110, 198, 255, 110), outline=body_outline, width=3)

    # legs
    left_leg = [(390, 860), (346, 900), (314, 1020), (360, 1120), (466, 1120), (490, 930), (468, 860)]
    right_leg = [(634, 860), (678, 900), (710, 1020), (664, 1120), (558, 1120), (534, 930), (556, 860)]
    draw.polygon(left_leg, fill=(110, 198, 255, 120), outline=body_outline, width=3)
    draw.polygon(right_leg, fill=(110, 198, 255, 120), outline=body_outline, width=3)

    # anatomical lines
    for x in (382, 470, 554, 642):
        draw.line((x, 260, x, 862), fill=bone_line, width=2)
    for y in (330, 430, 530, 650, 760):
        draw.line((286, y, 738, y), fill=bone_line, width=2)

    # orange muscle paths
    for points in [
        ((440, 310), (438, 470), (444, 560), (454, 730)),
        ((584, 310), (586, 470), (578, 560), (566, 730)),
        ((315, 420), (284, 600), (332, 790)),
        ((709, 420), (742, 600), (694, 790)),
        ((420, 300), (500, 360), (560, 300)),
        ((440, 610), (500, 660), (560, 610)),
        ((500, 420), (500, 540), (500, 760)),
    ]:
        draw.line(points, fill=muscle_line, width=5)

    # chest and pelvis markers
    for cx, cy in [(448, 380), (552, 380), (462, 540), (540, 540), (500, 770)]:
        draw.ellipse((cx - 10, cy - 10, cx + 10, cy + 10), fill=(255, 162, 82, 200), outline=(255, 215, 170, 220), width=2)

    # head glow and face outline
    draw.arc((440, 110, 585, 250), start=200, end=340, fill=body_outline, width=3)
    draw.arc((440, 110, 585, 250), start=20, end=160, fill=body_outline, width=3)

    # light overlays to resemble rendering
    glow = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    gdraw = ImageDraw.Draw(glow)
    gdraw.ellipse((270, 130, 754, 900), outline=(120, 220, 255, 80), width=2)
    image = Image.alpha_composite(image, glow)
    image = image.filter(ImageFilter.GaussianBlur(radius=0.9))
    return image


def generate_with_diffusers(model_id: str, width: int, height: int, steps: int, guidance_scale: float, prompt: str) -> Image.Image:
    if AutoPipelineForText2Image is None or torch is None:
        raise RuntimeError("diffusers / torch not installed")

    device = "cuda" if torch.cuda.is_available() else "cpu"
    torch_dtype = torch.float16 if device == "cuda" else torch.float32

    print(f"Using device: {device}")
    print(f"Loading model: {model_id}")

    pipe = AutoPipelineForText2Image.from_pretrained(model_id, torch_dtype=torch_dtype)
    pipe = pipe.to(device)
    pipe.enable_attention_slicing()

    image = pipe(
        prompt=prompt,
        num_inference_steps=steps,
        guidance_scale=guidance_scale,
        width=width,
        height=height,
    ).images[0]
    return image


def main() -> None:
    parser = argparse.ArgumentParser(description="Generate a 3D human body image with a local diffusion model.")
    parser.add_argument("--prompt", type=str, default="", help="Additional prompt text to customize the image.")
    parser.add_argument("--model-id", type=str, default="stabilityai/stable-diffusion-xl-base-1.0", help="Model to use.")
    parser.add_argument("--steps", type=int, default=30, help="Number of inference steps.")
    parser.add_argument("--guidance-scale", type=float, default=7.5, help="Guidance scale.")
    parser.add_argument("--width", type=int, default=1024, help="Image width.")
    parser.add_argument("--height", type=int, default=1024, help="Image height.")
    parser.add_argument("--output", type=str, default="output/medical_body_3d.png", help="Path to save the generated image.")
    args = parser.parse_args()

    output_path = Path(args.output)
    output_path.parent.mkdir(parents=True, exist_ok=True)

    prompt = build_prompt(args.prompt)

    try:
        image = generate_with_diffusers(args.model_id, args.width, args.height, args.steps, args.guidance_scale, prompt)
        print(f"Prompt used: {prompt}")
    except Exception as exc:
        print(f"Model generation unavailable, using local fallback image generator: {exc}")
        image = generate_placeholder_body(args.width, args.height)
        print(f"Prompt used for fallback: {prompt}")

    image.save(output_path)
    print(f"Image saved to: {output_path.resolve()}")


if __name__ == "__main__":
    main()
