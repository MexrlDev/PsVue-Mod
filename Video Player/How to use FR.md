Voici comment utiliser ce fichier YAML (workflow GitHub Actions) pour convertir automatiquement une vidéo au format HLS. Je vais te guider étape par étape, de l’ajout du fichier dans ton dépôt jusqu’au lancement du workflow.

---

1. Préparer ton dépôt GitHub

Si tu n’as pas encore de dépôt, crée-en un sur GitHub (public ou privé).
Tu peux aussi utiliser un dépôt existant.

Clone ce dépôt sur ton ordinateur (ou travaille directement sur GitHub web si tu préfères).

---

2. Ajouter le fichier YAML dans le bon dossier

Dans ton dépôt, il faut créer un dossier .github/workflows (si ce n’est pas déjà fait).
Place le fichier Cover-To-VUE.yaml dans ce dossier.

La structure doit ressembler à ceci :

```
mon-repo/
├── .github/
│   └── workflows/
│       └── Cover-To-VUE.yaml
├── (autres fichiers)
```

Tu peux ajouter ce fichier via l’interface web de GitHub (en cliquant sur « Add file ») ou en ligne de commande :

```bash
mkdir -p .github/workflows
cp /chemin/vers/Cover-To-VUE.yaml .github/workflows/
git add .github/workflows/Cover-To-VUE.yaml
git commit -m "Ajout du workflow de conversion HLS"
git push
```

---

3. Mettre une vidéo source dans ton dépôt

Le workflow a besoin d’une vidéo d’entrée (au format .mp4 ou .mov).
Place cette vidéo quelque part dans ton dépôt, par exemple dans un dossier videos/.

Exemple : videos/mon-film.mp4

Commite et pousse cette vidéo.

---

4. Lancer le workflow

· Va sur GitHub, dans la page de ton dépôt.
· Clique sur l’onglet Actions.
· Tu verras une liste des workflows. Sélectionne Convert Video to HLS (c’est le nom donné dans le fichier).
· Clique sur Run workflow (bouton à droite).
· Un formulaire s’affiche :
  · input_file : indique le chemin relatif vers ta vidéo, par exemple videos/mon-film.mp4.
  · output_name : nom de base pour les fichiers générés (sans extension). Par défaut cat-meow, mais tu peux mettre mon-film.
  · hls_time : durée de chaque segment HLS en secondes (par défaut 4).
· Clique sur Run workflow.

---

5. Suivre l’exécution

Le workflow va démarrer un job. Tu peux cliquer sur le job en cours pour voir les logs en direct.
Il va :

· Installer FFmpeg et Python.
· Vérifier que le fichier vidéo existe et a une extension valide.
· Convertir la vidéo en segments .ts et un fichier .m3u8 dans un dossier dist/[output_name]/.
· Créer une archive ZIP de ce dossier.
· Uploader l’archive comme artifact.

---

6. Récupérer le résultat

Une fois le workflow terminé, retourne dans l’onglet Actions, clique sur le workflow qui vient de s’exécuter.
En bas de la page, dans la section Artifacts, tu trouveras un fichier hls-video-zip. Clique dessus pour le télécharger.

Décompresse ce fichier, tu obtiendras un dossier contenant les fichiers HLS (.m3u8 et .ts). Tu peux ensuite les héberger sur un serveur ou les utiliser dans un lecteur vidéo.

---

Remarques importantes

· Le chemin de la vidéo doit être relatif à la racine du dépôt (par exemple videos/mon-film.mp4).
· Seuls les fichiers .mp4 et .mov sont acceptés.
· Le workflow utilise workflow_dispatch : il ne se déclenche pas automatiquement à chaque push, seulement manuellement depuis l’interface GitHub.
