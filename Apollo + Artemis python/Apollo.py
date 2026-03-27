# Apollo Save Tool Pc PYTHON port V2 | Dec, 19, 2025 
# Apollo: bucanero
# Python port: MexrlDev 2025

import pygame
import sys
import os

pygame.init()

# Screen setup
WIDTH, HEIGHT = 1280, 720
screen = pygame.display.set_mode((WIDTH, HEIGHT), pygame.RESIZABLE)
pygame.display.set_caption("Apollo Save Tool")

# Paths
images_path = "static/images"
font_path = "static/font/Adonais.ttf"
bg_music_path = os.path.join(images_path, "bg.mp3")

# Column configuration
TARGET_HEIGHT = 150
COLUMN_GAP = 20
COLUMN1_EXTRA_GAP = 50
COLUMN6_EXTRA_GAP = 80

# Per-column offsets and scales
column_offsets = [40, 11, 26, 0, 50, 0, 70]
column_scales = [1.0, 1.0, 1.0, 1.1, 1.0, 1.0, 1.0]

# Jar positioning adjustments
jar_offsets = [1, 1, 1, 1, 1, 1, 1]
jar_scale = 0.8 

# Jar labels
jar_labels = ["Trophies", "USB Saves", "HDD Saves", "Online DB", "Tools", "Settings", "About"]
label_font_size = 36
try:
    label_font = pygame.font.Font(font_path, label_font_size)
except FileNotFoundError:
    label_font = pygame.font.SysFont("Arial", label_font_size)

# Load and scale background images
apollo_img = pygame.image.load(os.path.join(images_path, "apollo.jpg")).convert_alpha()
intro_img = pygame.image.load(os.path.join(images_path, "buk_scr.png")).convert_alpha()

def resize_backgrounds(w, h):
    return pygame.transform.scale(apollo_img, (w, h)), intro_img

apollo_scaled, _ = resize_backgrounds(WIDTH, HEIGHT)

# Intro image scaling
intro_max_width, intro_max_height = 600, 400
iw, ih = intro_img.get_size()
scale_factor = min(intro_max_width / iw, intro_max_height / ih)
intro_scaled = pygame.transform.scale(intro_img, (int(iw * scale_factor), int(ih * scale_factor)))
intro_rect = intro_scaled.get_rect(center=(WIDTH // 2, HEIGHT // 2))

# Logo and text images
logo_img = pygame.image.load(os.path.join(images_path, "logo.png")).convert_alpha()
logo_img = pygame.transform.scale(logo_img, (280, 280))
logo_text_img = pygame.image.load(os.path.join(images_path, "logo_text.png")).convert_alpha()
orig_w, orig_h = logo_text_img.get_size()
scale_w = 500
scale_h = int(orig_h * (scale_w / orig_w))
logo_text_img = pygame.transform.scale(logo_text_img, (scale_w, scale_h))

# Credits
credits_text = "Created by MexrlDev"
try:
    credits_font = pygame.font.Font(font_path, 18)
except FileNotFoundError:
    credits_font = pygame.font.SysFont("Arial", 18)
credits_surface = credits_font.render(credits_text, True, (255, 255, 255))

# Load column images
column_files = [f"column_{i}.png" for i in range(1, 8)]
columns = [pygame.image.load(os.path.join(images_path, filename)).convert_alpha() for filename in column_files]

# Scale columns
scaled_columns = []
for i, col in enumerate(columns):
    w, h = col.get_size()
    scale_w = int(w * (TARGET_HEIGHT / h) * column_scales[i])
    scaled_columns.append(pygame.transform.scale(col, (scale_w, TARGET_HEIGHT)))

# Load jars and hover images
jar_names = ["jar_trophy", "jar_usb", "jar_hdd", "jar_db", "jar_bup", "jar_opt", "jar_about"]
jars, jars_hover = [], []
for name in jar_names:
    base_img = pygame.image.load(os.path.join(images_path, f"{name}.png")).convert_alpha()
    hover_img = pygame.image.load(os.path.join(images_path, f"{name}_hover.png")).convert_alpha()
    bw, bh = base_img.get_size()
    hw, hh = hover_img.get_size()
    jars.append(pygame.transform.scale(base_img, (int(bw * jar_scale), int(bh * jar_scale))))
    jars_hover.append(pygame.transform.scale(hover_img, (int(hw * jar_scale), int(hh * jar_scale))))

# Functions to update positions based on window size
def update_positions(w, h):
    logo_rect = logo_img.get_rect(center=(w // 2, h // 2 - 177))
    logo_text_rect = logo_text_img.get_rect(midtop=(logo_rect.centerx, logo_rect.bottom + 2))
    credits_rect = credits_surface.get_rect(bottomleft=(10, h - 10))
    return logo_rect, logo_text_rect, credits_rect

logo_rect, logo_text_rect, credits_rect = update_positions(WIDTH, HEIGHT)

def get_column_positions(w, h, gap=COLUMN_GAP, extra_gap=COLUMN1_EXTRA_GAP, gap6=COLUMN6_EXTRA_GAP):
    total_width = sum(col.get_width() for col in scaled_columns) + gap * (len(scaled_columns) - 1) + (extra_gap - gap) + (gap6 - gap)
    start_x = (w - total_width) // 2
    positions, x = [], start_x
    for i, col in enumerate(scaled_columns):
        rect = col.get_rect(midbottom=(x + col.get_width() // 2, h))
        rect.y += column_offsets[i]
        positions.append(rect)
        if i == 0:
            x += col.get_width() + extra_gap
        elif i == 5:
            x += col.get_width() + gap6
        else:
            x += col.get_width() + gap
    return positions

column_rects = get_column_positions(WIDTH, HEIGHT)

def get_jar_positions():
    return [
        jars[i].get_rect(midbottom=(column_rects[i].centerx, column_rects[i].top + jar_offsets[i]))
        for i in range(len(jars))
    ]

jar_rects = get_jar_positions()

# Setup music
try:
    pygame.mixer.music.load(bg_music_path)
except pygame.error:
    print("Background music not found.")

clock = pygame.time.Clock()

# States
STATE_INTRO = "intro"
STATE_SHOW_APOLLO = "show_apollo"
STATE_FADE_OUT = "fade_out"
STATE_ABOUT = "about"
STATE_RETURNING = "returning"
STATE_SHUTDOWN = "shutdown"
state = STATE_INTRO

# Timing variables
intro_start = None
apollo_start = None
white_overlay_start = None
shutdown_start = None
music_started = False

# Overlay surface for fade effects
overlay = pygame.Surface((WIDTH, HEIGHT)).convert()
overlay.fill((255, 255, 255))

# Fade functions
def fade_in(surface, duration, start_time):
    elapsed = pygame.time.get_ticks() - start_time
    alpha = max(0, 255 - int(255 * (elapsed / duration)))
    surface.set_alpha(alpha)
    return alpha

def fade_out(surface, duration, start_time):
    elapsed = pygame.time.get_ticks() - start_time
    alpha = min(255, int(255 * (elapsed / duration)))
    surface.set_alpha(alpha)
    return alpha

# Load About assets
help_img = pygame.image.load(os.path.join(images_path, "help.png")).convert_alpha()
cat_about_img = pygame.image.load(os.path.join(images_path, "cat_about.png")).convert_alpha()
top_line_img = pygame.image.load(os.path.join(images_path, "top_line.png")).convert_alpha()
memorial_img = pygame.image.load(os.path.join(images_path, "leon_luna.jpg")).convert_alpha()

# Force cat_about to be square
size = min(cat_about_img.get_width(), cat_about_img.get_height())
cat_about_img = pygame.transform.scale(cat_about_img, (size, size))

def scale_help_big(w, h):
    max_w, max_h = int(w * 0.85), int(h * 0.85)
    iw, ih = help_img.get_size()
    scale_factor = min(max_w / iw, max_h / ih)
    return pygame.transform.scale(help_img, (int(iw * scale_factor), int(ih * scale_factor)))

# Main loop
running = True
while running:
    current_time = pygame.time.get_ticks()
    mouse_pos = pygame.mouse.get_pos()

    for event in pygame.event.get():
        if event.type == pygame.QUIT:
            running = False
        elif event.type == pygame.KEYDOWN:
            if event.key == pygame.K_ESCAPE:
                if state == STATE_ABOUT:
                    state = STATE_RETURNING
                    white_overlay_start = current_time
                elif state in [STATE_SHOW_APOLLO, STATE_FADE_OUT]:
                    # Trigger shutdown animation
                    state = STATE_SHUTDOWN
                    shutdown_start = current_time
                    pygame.mixer.music.stop()
        elif event.type == pygame.MOUSEBUTTONDOWN and event.button == 1:
            for i, rect in enumerate(jar_rects):
                if rect.collidepoint(mouse_pos):
                    if jar_labels[i] == "About":
                        state = STATE_ABOUT
        elif event.type == pygame.VIDEORESIZE:
            WIDTH, HEIGHT = event.w, event.h
            screen = pygame.display.set_mode((WIDTH, HEIGHT), pygame.RESIZABLE)
            # Rescale backgrounds
            apollo_scaled, _ = resize_backgrounds(WIDTH, HEIGHT)
            overlay = pygame.Surface((WIDTH, HEIGHT)).convert()
            overlay.fill((255, 255, 255))
            # Update positions
            logo_rect, logo_text_rect, credits_rect = update_positions(WIDTH, HEIGHT)
            column_rects = get_column_positions(WIDTH, HEIGHT)
            jar_rects = get_jar_positions()
            intro_rect = intro_scaled.get_rect(center=(WIDTH // 2, HEIGHT // 2))

    # Clear screen
    screen.fill((0, 0, 0))

    # Handle states
    if state == STATE_INTRO:
        if intro_start is None:
            intro_start = current_time
        elapsed = current_time - intro_start
        if elapsed < 1000:
            fade_in(intro_scaled, 1000, intro_start)
            screen.blit(intro_scaled, intro_rect)
        elif elapsed < 3100:
            screen.blit(intro_scaled, intro_rect)
        elif elapsed < 4100:
            fade_out(intro_scaled, 1000, intro_start + 2100)
            screen.blit(intro_scaled, intro_rect)
        else:
            state = STATE_SHOW_APOLLO
            apollo_start = current_time

    elif state == STATE_SHOW_APOLLO:
        # Draw Apollo background
        screen.blit(apollo_scaled, (0, 0))
        # Play music once
        if not music_started:
            try:
                pygame.mixer.music.play(-1)
                music_started = True
            except:
                pass
        # Draw logo and text
        screen.blit(logo_img, logo_rect)
        screen.blit(logo_text_img, logo_text_rect)
        # Draw credits
        credits_rect = credits_surface.get_rect(bottomleft=(10, HEIGHT - 10))
        screen.blit(credits_surface, credits_rect)
        # Draw columns
        for col, rect in zip(scaled_columns, column_rects):
            screen.blit(col, rect)
        # Draw jars + hover effect + labels
        jar_rects = get_jar_positions()
        for i, rect in enumerate(jar_rects):
            screen.blit(jars[i], rect)
            if rect.collidepoint(mouse_pos):
                screen.blit(jars_hover[i], rect)
            label_surface = label_font.render(jar_labels[i], True, (0, 0, 0))
            label_surface.set_alpha(22)
            if rect.collidepoint(mouse_pos):
                label_surface.set_alpha(255)
            label_rect = label_surface.get_rect(midbottom=(rect.centerx, rect.top - 5))
            screen.blit(label_surface, label_rect)
        # Transition to fade out
        state = STATE_FADE_OUT

    elif state == STATE_FADE_OUT:
        # Draw Apollo UI
        screen.blit(apollo_scaled, (0, 0))
        screen.blit(logo_img, logo_rect)
        screen.blit(logo_text_img, logo_text_rect)
        credits_rect = credits_surface.get_rect(bottomleft=(10, HEIGHT - 10))
        screen.blit(credits_surface, credits_rect)
        for col, rect in zip(scaled_columns, column_rects):
            screen.blit(col, rect)
        jar_rects = get_jar_positions()
        for i, rect in enumerate(jar_rects):
            screen.blit(jars[i], rect)
            if rect.collidepoint(mouse_pos):
                screen.blit(jars_hover[i], rect)
            label_surface = label_font.render(jar_labels[i], True, (0, 0, 0))
            label_surface.set_alpha(80)
            if rect.collidepoint(mouse_pos):
                label_surface.set_alpha(255)
            label_rect = label_surface.get_rect(midbottom=(rect.centerx, rect.top - 5))
            screen.blit(label_surface, label_rect)
        # Overlay fade out
        if white_overlay_start is None:
            white_overlay_start = current_time
        elapsed = current_time - white_overlay_start
        alpha = max(0, 255 - int(255 * (elapsed / 5000)))
        overlay.set_alpha(alpha)
        screen.blit(overlay, (0, 0))
        # Transition to about or next state could be added here if needed

    elif state == STATE_ABOUT:
        # Draw background
        screen.blit(apollo_scaled, (0, 0))
        # Draw help panel scaled big
        help_scaled = scale_help_big(WIDTH, HEIGHT)
        help_rect = help_scaled.get_rect(center=(WIDTH // 2, HEIGHT // 2))
        screen.blit(help_scaled, help_rect)
        # Draw "about" info
        cat_size = min(cat_about_img.get_width(), cat_about_img.get_height())
        cat_about_img_scaled = pygame.transform.scale(cat_about_img, (cat_size, cat_size))
        cat_rect = cat_about_img_scaled.get_rect(topleft=(20, 20))
        screen.blit(cat_about_img_scaled, cat_rect)

        top_line_rect = top_line_img.get_rect(midleft=(cat_rect.right + 10, cat_rect.centery))
        screen.blit(top_line_img, top_line_rect)

        # Text info
        try:
            small_font = pygame.font.Font(font_path, 24)
        except FileNotFoundError:
            small_font = pygame.font.SysFont("Arial", 24)

        text1 = small_font.render("This is Apollo Save Tool PS3/PS4 copy but on pc, made with python", True, (255, 255, 255))
        text1_rect = text1.get_rect(midtop=(help_rect.centerx, help_rect.top + 40))
        screen.blit(text1, text1_rect)

        text1b = small_font.render("(Made By MexrlDev)", True, (255, 255, 255))
        text1b_rect = text1b.get_rect(midtop=(help_rect.centerx, text1_rect.bottom + 10))
        screen.blit(text1b, text1b_rect)

        text2 = label_font.render("In memory of leon and luna", True, (255, 255, 255))
        text2_rect = text2.get_rect(midtop=(help_rect.centerx, text1b_rect.bottom + 40))
        screen.blit(text2, text2_rect)

        # Memorial image
        mem_w, mem_h = 300, 200
        memorial_scaled = pygame.transform.scale(memorial_img, (mem_w, mem_h))
        memorial_rect = memorial_scaled.get_rect(midtop=(help_rect.centerx, text2_rect.bottom + 20))
        screen.blit(memorial_scaled, memorial_rect)

        # Bottom link text
        bottom_text = small_font.render("https://github.com/bucanero/apollo-ps3", True, (255, 255, 255))
        bottom_text_rect = bottom_text.get_rect(midbottom=(help_rect.centerx, help_rect.bottom - 20))
        screen.blit(bottom_text, bottom_text_rect)

    elif state == STATE_RETURNING:
        # Fade back to Apollo
        screen.blit(apollo_scaled, (0, 0))
        elapsed = current_time - white_overlay_start
        alpha = min(255, int(255 * (elapsed / 1500)))
        overlay.set_alpha(alpha)
        screen.blit(overlay, (0, 0))
        if elapsed >= 1500:
            state = STATE_SHOW_APOLLO
            white_overlay_start = None

    elif state == STATE_SHUTDOWN:
        # White background with closing bars
        screen.fill((255, 255, 255))
        logo_rect = logo_img.get_rect(center=(WIDTH // 2, HEIGHT // 2))
        screen.blit(logo_img, logo_rect)

        elapsed = current_time - shutdown_start
        progress = min(1.0, elapsed / 4000.0)  # 4 seconds

        bar_height = int((HEIGHT // 2) * progress)
        # Top bar
        top_rect = pygame.Rect(0, 0, WIDTH, bar_height)
        pygame.draw.rect(screen, (0, 0, 0), top_rect)
        # Bottom bar
        bottom_rect = pygame.Rect(0, HEIGHT - bar_height, WIDTH, bar_height)
        pygame.draw.rect(screen, (0, 0, 0), bottom_rect)

        if progress >= 1.0:
            running = False

    pygame.display.flip()
    clock.tick(60)

pygame.quit()
sys.exit()
