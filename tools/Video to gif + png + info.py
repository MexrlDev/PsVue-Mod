import os
import shutil
import tkinter as tk
from tkinter import filedialog, messagebox
import imageio
from moviepy.editor import VideoFileClip
from PIL import Image, ImageSequence

# Select file (video or gif)
root = tk.Tk()
root.withdraw()

input_path = filedialog.askopenfilename(
    title="Select a video (under 17s) or a GIF",
    filetypes=[("Media Files", "*.mp4 *.mov *.avi *.mkv *.webm *.gif"),
               ("GIF", "*.gif"),
               ("Video Files", "*.mp4 *.mov *.avi *.mkv *.webm")]
)

if not input_path:
    print("No file selected.")
    exit()

# Paths / Folders
input_dir = os.path.dirname(input_path)
input_name = os.path.splitext(os.path.basename(input_path))[0]

output_root = os.path.join(input_dir, f"{input_name}_output")
gif_folder = os.path.join(output_root, "gif")
pics_folder = os.path.join(output_root, "pics")

os.makedirs(gif_folder, exist_ok=True)
os.makedirs(pics_folder, exist_ok=True)

gif_path = os.path.join(gif_folder, f"{input_name}.gif")

# Helper: compute GIF duration (seconds) using PIL frame durations
def compute_gif_duration_pil(path):
    try:
        total_ms = 0
        with Image.open(path) as im:
            for frame in ImageSequence.Iterator(im):
                info = frame.info
                # 'duration' is in milliseconds for GIF frames (Pillow)
                frame_ms = info.get('duration', 0)
                total_ms += frame_ms
        # If total_ms == 0, PIL didn't provide durations; fallback to None
        if total_ms == 0:
            return None
        return total_ms / 1000.0
    except Exception:
        return None

# Resize a PIL image to width 480 preserving aspect ratio
def resize_to_width_480(pil_img):
    w, h = pil_img.size
    if w == 480:
        return pil_img
    new_w = 480
    new_h = max(1, int(h * (new_w / w)))
    return pil_img.resize((new_w, new_h), Image.LANCZOS)

# Main flow: if input is GIF, skip conversion; otherwise convert video -> gif then extract
ext = os.path.splitext(input_path)[1].lower()

if ext == ".gif":
    print("GIF selected — skipping video-to-gif conversion.")
    # Copy original GIF into gif_folder (overwrite)
    try:
        shutil.copy2(input_path, gif_path)
        print("Copied GIF to:", gif_path)
    except Exception as e:
        messagebox.showerror("Error", f"Failed to copy GIF: {e}")
        exit()

    # Compute duration (and enforce 17s limit if available)
    duration = compute_gif_duration_pil(gif_path)
    if duration is not None and duration > 17:
        messagebox.showerror("Error", f"GIF is {duration:.2f}s — must be under 17 seconds.")
        exit()

    # Extract frames from GIF (and resize to width 480)
    print("Extracting frames from GIF...")
    frame_count = 0
    try:
        gif_reader = imageio.get_reader(gif_path)
        for i, frame in enumerate(gif_reader):
            frame_image = Image.fromarray(frame)
            frame_image = resize_to_width_480(frame_image)

            frame_name = f"frame_{i:03d}.png"
            frame_path = os.path.join(pics_folder, frame_name)

            frame_image.save(frame_path)
            frame_count += 1
        gif_reader.close()
    except Exception as e:
        messagebox.showerror("Error", f"Failed to extract frames from GIF: {e}")
        exit()

    # If duration was not available from PIL, try to infer from imageio metadata (best-effort)
    if duration is None:
        try:
            meta = imageio.get_reader(gif_path).get_meta_data()
            # imageio sometimes provides 'duration' in seconds
            duration = meta.get('duration', None)
        except Exception:
            duration = None

else:
    # Treat as video
    print("Video selected — converting to GIF...")
    try:
        clip = VideoFileClip(input_path)
    except Exception as e:
        messagebox.showerror("Error", f"Failed to open video: {e}")
        exit()

    duration = clip.duration
    if duration > 17:
        messagebox.showerror(
            "Error",
            f"Video is {duration:.2f}s — must be under 17 seconds."
        )
        clip.close()
        exit()

    # Resize and write GIF at 20 fps
    try:
        clip_resized = clip.resize(width=480)
        clip_resized.write_gif(gif_path, fps=20)
        clip_resized.close()
        clip.close()
    except Exception as e:
        messagebox.showerror("Error", f"Failed to convert video to GIF: {e}")
        try:
            clip.close()
        except Exception:
            pass
        exit()

    print("GIF created:", gif_path)

    # Extract frames from the newly created GIF
    print("Extracting frames...")
    frame_count = 0
    try:
        gif_reader = imageio.get_reader(gif_path)
        for i, frame in enumerate(gif_reader):
            frame_image = Image.fromarray(frame)
            # frames from the written gif should already be width=480, but ensure and resize just in case
            frame_image = resize_to_width_480(frame_image)

            frame_name = f"frame_{i:03d}.png"
            frame_path = os.path.join(pics_folder, frame_name)

            frame_image.save(frame_path)
            frame_count += 1
        gif_reader.close()
    except Exception as e:
        messagebox.showerror("Error", f"Failed to extract frames: {e}")
        exit()

# Create GIF Info TXT (UTF-8)
info_txt_path = os.path.join(output_root, "gif_info.txt")

with open(info_txt_path, "w", encoding="utf-8") as f:
    f.write("GIF INFORMATION\n")
    f.write("=====================\n")
    f.write(f"Source File: {os.path.basename(input_path)}\n")
    f.write(f"Output GIF: {os.path.basename(gif_path)}\n")
    if duration is not None:
        f.write(f"Duration: {duration:.2f} seconds\n")
    else:
        f.write(f"Duration: unknown (couldn't determine)\n")
    f.write("FPS: 20 (video conversion path) / frame delays preserved for original GIFs\n")
    f.write("Frame Delay: Auto (derived from GIF metadata or FPS)\n")
    f.write(f"Total Frames: {frame_count}\n\n")

    f.write("FRAME NAMING:\n")
    f.write("frame_000.png -> frame_xxx.png\n\n")

    f.write("FOLDER STRUCTURE:\n")
    f.write(f"{input_name}_output/\n")
    f.write(" ├── gif/\n")
    f.write(" │    └── input_name.gif\n")
    f.write(" ├── pics/\n")
    f.write(" │    └── frame_###.png\n")

print(f"{frame_count} frames extracted.")
print("gif_info.txt created at:", info_txt_path)

# Show Done Message
messagebox.showinfo(
    "Done",
    "GIF + PNG frames created successfully."
)
