# Artemis python port.. Dec, 19, 2025
# Original Artemis: Berion, NzV, Dnawrkshp
# MexrlDev 2025
# Free for anyone to use, mod, edit privatly, publish with credits to original creators.

import pygame, sys, os, time

pygame.init()

# --- Config ---
WIDTH, HEIGHT = 1280, 640
FPS = 60
ICON_GAP = 30
ICON_OFFSET_X = 0
ICON_OFFSET_Y = -200
LOGO_OFFSET_Y = 100

ICON_SIZE_W = 0.1
ICON_SIZE_H = 0.1

# --- Setup ---
screen = pygame.display.set_mode((WIDTH, HEIGHT))  # windowed by default
clock = pygame.time.Clock()

# --- Load assets ---
bg = pygame.image.load(os.path.join("data", "bgimg.png")).convert()
logo = pygame.image.load(os.path.join("data", "titlescr_logo.png")).convert_alpha()
help_img = pygame.image.load(os.path.join("data", "help.png")).convert()

icons = [
    pygame.image.load(os.path.join("data", "titlescr_ico_xmb.png")).convert_alpha(),
    pygame.image.load(os.path.join("data", "titlescr_ico_cht.png")).convert_alpha(),
    pygame.image.load(os.path.join("data", "titlescr_ico_opt.png")).convert_alpha(),
    pygame.image.load(os.path.join("data", "titlescr_ico_abt.png")).convert_alpha()  # About (index 3)
]

icon_labels = ["Start Game", "Cheat Menu", "Options", "About"]

# --- Fonts ---
pygame.font.init()
font_logo   = pygame.font.Font(os.path.join("data", "comfortaa_regular.ttf"), 17)
font_icons  = pygame.font.Font(os.path.join("data", "comfortaa_bold.ttf"), 15)
font_bottom = pygame.font.SysFont("Arial", 14)
font_help   = pygame.font.SysFont("Arial", 24, bold=True)

# --- States ---
STATE_MENU = "menu"
STATE_HELP = "help"
STATE_CLOSING = "closing"
state = STATE_MENU
animating = False
esc_count = 0

# --- Helpers ---
def scale_aspect(image, max_w, max_h):
    iw, ih = image.get_size()
    scale = min(max_w/iw, max_h/ih) if iw > 0 and ih > 0 else 1
    new_size = (max(1, int(iw*scale)), max(1, int(ih*scale)))
    return pygame.transform.smoothscale(image, new_size)

def compute_icon_layout():
    w, h = screen.get_size()
    icon_scaled = [scale_aspect(icon, int(w*ICON_SIZE_W), int(h*ICON_SIZE_H)) for icon in icons]
    total_width = sum(ic.get_width() for ic in icon_scaled) + ICON_GAP * (len(icon_scaled) - 1)
    start_x = (w - total_width) // 2 + ICON_OFFSET_X
    y = h - max(ic.get_height() for ic in icon_scaled) + ICON_OFFSET_Y
    return icon_scaled, start_x, y

# --- Draw menu ---
def draw_menu():
    bg_scaled = pygame.transform.smoothscale(bg, screen.get_size())
    screen.blit(bg_scaled, (0, 0))

    w, h = screen.get_size()

    logo_scaled = scale_aspect(logo, int(w * 0.4), int(h * 0.2))
    logo_rect = logo_scaled.get_rect(center=(w // 2, h // 6 + LOGO_OFFSET_Y))
    screen.blit(logo_scaled, logo_rect)

    subtitle = font_logo.render("cross   platform   hacking   system", True, (0, 0, 0))
    subtitle_rect = subtitle.get_rect(center=(w // 2, logo_rect.bottom + 20))
    screen.blit(subtitle, subtitle_rect)

    icon_scaled, start_x, y = compute_icon_layout()
    mouse_pos = pygame.mouse.get_pos()
    x = start_x

    for i, icon_img in enumerate(icon_scaled):
        rect = icon_img.get_rect(topleft=(x, y))
        icon_copy = icon_img.copy()
        if rect.collidepoint(mouse_pos):
            icon_copy.set_alpha(255)
            text_alpha = 255
        else:
            icon_copy.set_alpha(100)
            text_alpha = 100

        screen.blit(icon_copy, rect.topleft)

        label_surface = font_icons.render(icon_labels[i], True, (0, 0, 0))
        label_surface.set_alpha(text_alpha)
        label_rect = label_surface.get_rect(center=(rect.centerx, rect.bottom + 15))
        screen.blit(label_surface, label_rect)

        x += icon_img.get_width() + ICON_GAP

    bottom_text = font_bottom.render("www.gamehacking.org/artemis", True, (0, 0, 0))
    bottom_rect = bottom_text.get_rect(center=(w // 2, h - 20))
    screen.blit(bottom_text, bottom_rect)

# --- Draw help screen ---
def draw_help():
    bg_scaled = pygame.transform.smoothscale(bg, screen.get_size())
    screen.blit(bg_scaled, (0, 0))

    help_scaled = pygame.transform.smoothscale(help_img, screen.get_size())
    screen.blit(help_scaled, (0, 0))

    w, h = screen.get_size()
    text1 = font_help.render("This is a PC copy of a PS3 Artemis made with Python.", True, (255, 255, 255))
    rect1 = text1.get_rect(center=(w // 2, h // 2 - 20))
    screen.blit(text1, rect1)

    text2 = font_help.render("(Made by MexrlDev)", True, (255, 255, 255))
    rect2 = text2.get_rect(center=(w // 2, h // 2 + 20))
    screen.blit(text2, rect2)

# --- Animations ---
def fade_to_menu_1_5s():
    global animating, state
    animating = True
    flash = pygame.Surface(screen.get_size())
    flash.fill((255, 255, 255))
    steps = int(1.5 * FPS)
    for i in range(steps):
        alpha = 255 - int(255 * (i / steps))
        flash.set_alpha(alpha)
        draw_menu()
        screen.blit(flash, (0, 0))
        pygame.display.flip()
        clock.tick(FPS)
    state = STATE_MENU
    animating = False

def closing_animation_4s():
    global animating
    animating = True
    w, h = screen.get_size()
    steps = int(4 * FPS)
    for i in range(steps):
        screen.fill((255, 255, 255))
        logo_scaled = scale_aspect(logo, int(w * 0.4), int(h * 0.2))
        logo_rect = logo_scaled.get_rect(center=(w // 2, h // 2))
        screen.blit(logo_scaled, logo_rect)

        bar_height = int((i / steps) * (h // 2))
        top_bar = pygame.Surface((w, bar_height))
        bottom_bar = pygame.Surface((w, bar_height))
        top_bar.fill((0, 0, 0))
        bottom_bar.fill((0, 0, 0))
        screen.blit(top_bar, (0, 0))
        screen.blit(bottom_bar, (0, h - bar_height))

        pygame.display.flip()
        clock.tick(FPS)

    pygame.quit()
    sys.exit()

def intro_sequence():
    screen.fill((0, 0, 0))
    pygame.display.flip()
    time.sleep(2)

    try:
        pygame.mixer.music.load(os.path.join("data", "bg.mp3"))
        pygame.mixer.music.play(-1)
    except:
        pass

    flash = pygame.Surface(screen.get_size())
    flash.fill((255, 255, 255))
    steps = int(4 * FPS)
    for i in range(steps):
        alpha = 255 - int(255 * (i / steps))
        flash.set_alpha(alpha)
        draw_menu()
        screen.blit(flash, (0, 0))
        pygame.display.flip()
        clock.tick(FPS)

# --- Input handlers ---
def handle_mouse_click(pos):
    global state, esc_count
    if animating or state != STATE_MENU:
        return
    icon_scaled, start_x, y = compute_icon_layout()
    x = start_x
    for i, icon_img in enumerate(icon_scaled):
        rect = icon_img.get_rect(topleft=(x, y))
        if rect.collidepoint(pos):
            if i == 3:  # About
                state = STATE_HELP
                esc_count = 0
            break
        x += icon_img.get_width() + ICON_GAP

def handle_escape():
    global state, esc_count
    if animating:
        return
    if state == STATE_HELP:
        fade_to_menu_1_5s()
        esc_count = 1
    elif state == STATE_MENU:
        if esc_count == 1:
            closing_animation_4s()
        else:
            esc_count = 1
# --- Main loop ---
def main():
    intro_sequence()
    running = True
    while running:
        for event in pygame.event.get():
            if event.type == pygame.QUIT:
                running = False
            elif event.type == pygame.MOUSEBUTTONDOWN and event.button == 1:
                handle_mouse_click(event.pos)
            elif event.type == pygame.KEYDOWN:
                if event.key == pygame.K_ESCAPE:
                    handle_escape()
                elif event.key == pygame.K_f:
                    # Toggle fullscreen when user presses F
                    pygame.display.set_mode((WIDTH, HEIGHT), pygame.FULLSCREEN)
                elif event.key == pygame.K_w:
                    # Toggle back to windowed when user presses W
                    pygame.display.set_mode((WIDTH, HEIGHT))

        # Draw based on state
        if state == STATE_MENU:
            draw_menu()
        elif state == STATE_HELP:
            draw_help()
        elif state == STATE_CLOSING:
            # Closing animation is handled separately
            pass

        pygame.display.flip()
        clock.tick(FPS)

    pygame.quit()
    sys.exit()


if __name__ == "__main__":
    main()
