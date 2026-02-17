import os
import tkinter as tk
from tkinter import filedialog, messagebox
import imageio
from moviepy import VideoFileClip
from PIL import Image

# Selects video
root = tk.Tk()
root.withdraw()

video_path = filedialog.askopenfilename(
    title="Select a video under 17 seconds",
    filetypes=[("Video Files", "*.mp4 *.mov *.avi *.mkv *.webm")]
)

if not video_path:
    print("No video selected.")
    exit()

# Load Video
clip = VideoFileClip(video_path)
duration = clip.duration

if duration > 17:
    messagebox.showerror(
        "Error",
        f"Video is {duration:.2f}s — must be under 17 seconds."
    )
    exit()


# Paths / Folders
video_dir = os.path.dirname(video_path)
video_name = os.path.splitext(os.path.basename(video_path))[0]

output_root = os.path.join(video_dir, f"{video_name}_output")
gif_folder = os.path.join(output_root, "gif")
pics_folder = os.path.join(output_root, "pics")

os.makedirs(gif_folder, exist_ok=True)
os.makedirs(pics_folder, exist_ok=True)

gif_path = os.path.join(gif_folder, f"{video_name}.gif")


# Convert Video → GIF (20 FPS)
print("Converting video to GIF...")

clip_resized = clip.resized(width=480)

clip_resized.write_gif(
    gif_path,
    fps=20
)

print("GIF created:", gif_path)


# Extract GIF → PNG Frames
print("Extracting frames...")

gif = imageio.get_reader(gif_path)

frame_count = 0

for i, frame in enumerate(gif):
    frame_image = Image.fromarray(frame)

    frame_name = f"frame_{i:03d}.png"
    frame_path = os.path.join(pics_folder, frame_name)

    frame_image.save(frame_path)
    frame_count += 1

print(f"{frame_count} frames extracted.")

# Create GIF Info TXT (UTF-8)
info_txt_path = os.path.join(output_root, "gif_info.txt")

with open(info_txt_path, "w", encoding="utf-8") as f:
    f.write("GIF INFORMATION\n")
    f.write("=====================\n")
    f.write(f"Source Video: {video_name}\n")
    f.write(f"Duration: {duration:.2f} seconds\n")
    f.write("FPS: 20\n")
    f.write("Frame Delay: Auto (derived from FPS)\n")
    f.write(f"Total Frames: {frame_count}\n\n")

    f.write("FRAME NAMING:\n")
    f.write("frame_000.png -> frame_xxx.png\n\n")

    f.write("FOLDER STRUCTURE:\n")
    f.write(f"{video_name}_output/\n")
    f.write(" ├── gif/\n")
    f.write(" │    └── video.gif\n")
    f.write(" ├── pics/\n")
    f.write(" │    └── frame_###.png\n")

print("gif_info.txt created.")


# Show  Done  Message

messagebox.showinfo(
    "Done",
    "GIF + PNG frames created successfully."
)
