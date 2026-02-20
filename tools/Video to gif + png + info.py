import os
import shutil
import tkinter as tk
from tkinter import filedialog, messagebox
import imageio
import numpy as np
from PIL import Image, ImageSequence

# Set to a number (seconds) to enforce a max duration, or None for unlimited
MAX_DURATION = None  # None = unlimited

# UI
root = tk.Tk()
root.withdraw()

input_path = filedialog.askopenfilename(
    title="Select a video or a GIF",
    filetypes=[("Media Files", "*.mp4 *.mov *.avi *.mkv *.webm *.gif"),
               ("GIF", "*.gif"),
               ("Video Files", "*.mp4 *.mov *.avi *.mkv *.webm")]
)

if not input_path:
    print("No file selected.")
    exit()

input_dir = os.path.dirname(input_path)
input_name = os.path.splitext(os.path.basename(input_path))[0]

output_root = os.path.join(input_dir, f"{input_name}_output")
gif_folder = os.path.join(output_root, "gif")
pics_folder = os.path.join(output_root, "pics")

os.makedirs(gif_folder, exist_ok=True)
os.makedirs(pics_folder, exist_ok=True)

gif_path = os.path.join(gif_folder, f"{input_name}.gif")

def compute_gif_duration_pil(path):
    try:
        total_ms = 0
        with Image.open(path) as im:
            for frame in ImageSequence.Iterator(im):
                total_ms += frame.info.get('duration', 0)
        return (total_ms / 1000.0) if total_ms else None
    except Exception:
        return None

def resize_to_width_480(pil_img):
    w, h = pil_img.size
    if w == 480:
        return pil_img
    new_w = 480
    new_h = max(1, int(h * (new_w / w)))
    return pil_img.resize((new_w, new_h), Image.LANCZOS)

ext = os.path.splitext(input_path)[1].lower()

frame_count = 0
duration = None

try:
    if ext == ".gif":
        # Copy original GIF
        shutil.copy2(input_path, gif_path)
        duration = compute_gif_duration_pil(gif_path)
        if MAX_DURATION is not None and duration is not None and duration > MAX_DURATION:
            messagebox.showerror("Error", f"GIF is {duration:.2f}s — must be under {MAX_DURATION} seconds.")
            raise SystemExit

        # Extract frames (and resize to width 480)
        reader = imageio.get_reader(gif_path)
        for i, frame in enumerate(reader):
            pil = Image.fromarray(frame)
            pil = resize_to_width_480(pil)
            frame_name = f"frame_{i:03d}.png"
            frame_path = os.path.join(pics_folder, frame_name)
            pil.save(frame_path)
            frame_count += 1
        reader.close()

    else:
        # Treat as video: read frames via imageio (ffmpeg plugin) and write output GIF
        reader = imageio.get_reader(input_path, 'ffmpeg')
        meta = reader.get_meta_data()
        # meta may have 'duration' in seconds or approximate fps
        # We can estimate duration from frames and fps if available
        fps = meta.get('fps', None)
        if fps is not None:
            try:
                # count frames to estimate duration later (but counting already reads them)
                pass
            except Exception:
                pass

        # If MAX_DURATION is set, try to compute duration using any available metadata (best-effort)
        if MAX_DURATION is not None:
            # attempt to estimate using duration provided by metadata
            if 'duration' in meta and meta['duration'] is not None:
                duration = meta['duration']
                if duration > MAX_DURATION:
                    messagebox.showerror("Error", f"Video is {duration:.2f}s — must be under {MAX_DURATION} seconds.")
                    reader.close()
                    raise SystemExit

        # Write a resized GIF from the video frames
        writer = imageio.get_writer(gif_path, mode='I', fps=20)
        for i, frame in enumerate(reader):
            pil = Image.fromarray(frame)
            pil = resize_to_width_480(pil)
            writer.append_data(np.array(pil))
            # also save PNG frame
            frame_name = f"frame_{i:03d}.png"
            pil.save(os.path.join(pics_folder, frame_name))
            frame_count += 1
        writer.close()
        reader.close()

except SystemExit:
    # termination due to error already shown by messagebox
    exit()
except Exception as e:
    messagebox.showerror("Error", f"Processing failed: {e}")
    raise

# If duration not known and GIF exists, try to compute it
if duration is None and os.path.exists(gif_path):
    duration = compute_gif_duration_pil(gif_path)

# Write info file
info_txt_path = os.path.join(output_root, "gif_info.txt")
with open(info_txt_path, "w", encoding="utf-8") as f:
    f.write("GIF INFORMATION\n")
    f.write("=====================\n")
    f.write(f"Source File: {os.path.basename(input_path)}\n")
    f.write(f"Output GIF: {os.path.basename(gif_path)}\n")
    if duration is not None:
        f.write(f"Duration: {duration:.2f} seconds\n")
    else:
        f.write("Duration: unknown\n")
    if MAX_DURATION is None:
        f.write("Duration limit: unlimited\n")
    else:
        f.write(f"Duration limit: {MAX_DURATION} seconds\n")
    f.write("FPS: 20 (video conversion path) / frame delays preserved for original GIFs\n")
    f.write(f"Total Frames: {frame_count}\n\n")

print(f"{frame_count} frames extracted.")
print("gif_info.txt created at:", info_txt_path)
messagebox.showinfo("Done", "GIF + PNG frames created successfully.")
