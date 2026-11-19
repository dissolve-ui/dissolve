# dissolve-ui : 10 nouvelles variantes

J'ai lu `src/dissolve/index.tsx`, `src/dissolve/Particles.tsx`, `src/dissolve/presets.ts` et `site/dissolve.js`. Je n'ai modifié aucun fichier.

## 0. Socle commun : trois petits refactors

Plusieurs variantes en dépendent. Il vaut mieux les faire avant de commencer.

1. **Séparer le champ de délai et le mouvement.** Aujourd'hui `local()` (le délai) et le bloc de position sont liés par preset. Avec un `origin` à part (`'left' | 'right' | 'top' | 'bottom' | 'center' | 'touch' | {x,y}`), chaque preset existant gagne une direction. Exemple : `delay = dist(l, O) / maxD * 0.55 + r1 * 0.08`.
2. **Accepter un `progress` externe dans `Particles`.** Il prend une `SharedValue` optionnelle au lieu de son `withTiming` interne. La position est déjà une fonction pure de `p`, sans état d'une frame à l'autre. Le scrub, le rembobinage et l'entrée deviennent donc presque gratuits.
3. **Ajouter des champs libres au `Burst`** (`ox`, `oy`, `vx`, `vy`, `tx`, `ty`…). Le worklet les capture comme constantes.

Note perf (le code actuel dit `pr = image.width() / w`, je l'écris `pr` ci-dessous) :
- `local()` est calculé deux fois par grain et par frame : une fois pour les transforms, une fois pour les colors.
- Sur les gros bursts, on peut supprimer le color buffer et faire le fondu par `s → 0`, ce qui divise le coût par environ 2.

Helpers utilisés dans le pseudo-code : `ss(t) = t*t*(3-2t)`, `eo(t) = 1-(1-t)^3`, `backOut(t) = 1 + 2.7(t-1)^3 + 1.7(t-1)^2`.

---

## 1. `snap` : se désintègre depuis le doigt

**Pitch.** L'onde part du point touché et souffle les grains vers l'extérieur.

**Cas d'usage.** Supprimer une photo d'une grille, une carte de wishlist ou une notif tapée. Le geste et l'effet partent du même pixel, c'est ce qui fait l'effet.

**Maths.**
- Entrées : `ox`, `oy` (le toucher local, soit `pageX - box.x`) et `maxD` (distance au coin le plus loin, calculée côté JS).

```
dx=lx-ox; dy=ly-oy; d=sqrt(dx*dx+dy*dy)
delay = d/maxD*0.55 + r1*0.08; life = 0.45
ux = d<1 ? cos(r4*6.28) : dx/d; uy = d<1 ? sin(r4*6.28) : dy/d
push = (30 + r2*110)*e
cx += ux*push - uy*(r3-0.5)*30*e      // léger tourbillon tangent
cy += uy*push + vy... - 20*e          // petit souffle vers le haut
s = 1 - 0.6t; rot = (r4-0.5)*4*e; a = 1 - ss(t)
```

**API.**
- `dissolve({ preset: 'snap', origin: { x: e.nativeEvent.locationX, y: e.nativeEvent.locationY } })`
- `origin: 'touch'` peut aussi s'appliquer à `dust`, `sand`, etc.

**Faisabilité.** Atlas pur, aucun coût en plus. Une seule capture d'écran. Portage web trivial. Difficulté **S**.

---

## 2. `fling` : emporté dans le sens et à la vitesse du swipe

**Pitch.** Le swipe-to-delete continue en tempête de grains : plus le swipe est rapide, plus ça part loin et vite.

**Cas d'usage.** Swipe d'une ligne de mail, d'une conversation ou d'une carte façon Tinder « je passe ».

**Maths.**
- Entrées : `vx`, `vy` (vitesse du `onEnd` RNGH, en pt/s).

```
sp = hypot(vx,vy); ux=vx/sp; uy=vy/sp; nx=-uy; ny=ux
k = clamp(sp/1500, 0.4, 2)
pn = ((lx-w/2)*ux + (ly-h/2)*uy)/maxR          // -1..1
delay = (1-(pn+1)/2)*0.45 + r1*0.1; life = 0.42/sqrt(k)
travel = (80 + r2*160)*k
cx += ux*(travel*e + sp*0.05*t) + nx*(r3-0.5)*40*k*e   // terme linéaire = élan hérité, ça part dès t>0
cy += uy*(travel*e + sp*0.05*t) + ny*(r3-0.5)*40*k*e
s = 1 - 0.5t; rot = (r4-0.5)*5*k*e
```

La durée suit la vitesse : `duration = clamp(1800 - sp*0.4, 700, 1500)`.

**API.** `dissolve({ preset: 'fling', velocity: { x: e.velocityX, y: e.velocityY } })`

**Faisabilité.** Atlas pur. Difficulté **S**. Peu impressionnant seul, mais c'est le geste le plus naturel sur mobile.

---

## 3. `stream` : les grains volent vers une cible (et l'inverse pour l'entrée)

**Pitch.**
- **Sortie :** la carte se vide en un flux de grains qui atterrit dans l'icône corbeille ou le badge d'onglet, et le badge rebondit en « +1 ».
- **Entrée :** l'inverse. La bulle d'un nouveau message se forme à partir de grains qui jaillissent du bouton Envoyer.

**Cas d'usage.** Ajout au panier (produit vers icône panier), archivage (mail vers onglet Archives), suppression vers la corbeille, message envoyé.

**Maths.**
- Entrées : `tx`, `ty`, le centre de la cible en coordonnées fenêtre (`measureInWindow` de la ref cible). Pour l'entrée, c'est la source.
- `maxDT` est calculé en JS.

```
P0 = (x+lx, y+ly); P2 = (tx+(r2-0.5)*6, ty+(r3-0.5)*6)
P1 = ((P0x+P2x)/2 + (r4-0.5)*120, min(P0y,P2y) - 80 - r2*120)
delay = dist(P0,P2)/maxDT*0.45 + r1*0.15; life = 0.5    // les plus proches partent en premier = effet "aspiré"
u = ss(t)
B = (1-u)²P0 + 2(1-u)u P1 + u² P2
s = 1 - 0.7u; rot = (r4-0.5)*8*u
a = t<0.9 ? 1 : (1-t)/0.1          // ne disparaît qu'à l'arrivée
```

- **Mode entrée :** on inverse P0 et P2 (départ à la source, arrivée à `x+lx`, `y+ly`), puis `u = eo(t)` et `s = 0.3 + 0.7u`.
- **Haptique d'arrivée :** la distribution des arrivées `delay + life` est connue d'avance. On déclenche des ticks aux quantiles 10/30/50/70/90 % et `onArrive()` à 50 % pour faire rebondir la cible.

**API.**
```ts
const trash = useRef<View>(null);
await dissolve({ preset: 'stream', to: trash, onArrive: () => bounce() });
// entrée
<DissolveIn from={sendButtonRef} preset="stream">{bubble}</DissolveIn>
```

**Faisabilité.**
- Atlas pur. Les grains sortent de la vue sans problème, car le Canvas est déjà en `absoluteFill` dans le provider.
- Une seule capture. Grain de 3 à 4 pour garder un flux lisible.
- Difficulté **S/M**.

---

## 4. `assemble` : l'entrée générique (mount, insertion dans une liste)

**Pitch.** La vue se matérialise à partir de grains. Trois styles :
- `gather` : un nuage qui converge avec un overshoot ;
- `rain` : les grains tombent d'en haut et se posent ;
- `print` : ligne par ligne de haut en bas, avec un trait lumineux de balayage.

**Cas d'usage.** Nouvelle notif dans une liste, carte de résultat IA qui apparaît, écran de succès après paiement, item inséré dans une FlatList.

**Maths (`gather`).**

```
ang = r2*6.28; dist = 40 + r3*120; sx = cos(ang)*dist; sy = sin(ang)*dist
delay = (ly/h)*0.4 + (lx/w)*0.1 + r1*0.15; life = 0.5
u = backOut(t)
cx = x+lx + sx*(1-u); cy = y+ly + sy*(1-u)
s = 0.4 + 0.6*min(1, t*1.5); rot = (r4-0.5)*4*(1-u)
a = ss(min(1, t*2.5))
```

- **`rain` :** `sx = (r2-0.5)*20`, `sy = -(120 + r3*200)`. On remplace `u` par un bounceOut.
- **`print` :** `delay = (ly/h)*0.8 + r1*0.03`, `sy = -8`. Le trait est un `<Rect>` dans le même Canvas, à `y = y + h*(p/0.8)`.
- **Invariant obligatoire :** à t = 1, on a exactement `cx = x+lx`, `s = 1`, `rot = 0`.

**API.**
- `const { ref, appear } = useDissolve(); useEffect(() => { appear({ preset: 'gather' }) }, [])`
- ou le wrapper `<DissolveIn preset="rain" delay={index*40}>`

**Faisabilité.**
- Point délicat : capturer une vue qui n'est pas encore visible. Le flux prévu : montée à `opacity: 0`, `onLayout`, une frame, `makeImageFromView`, animation, puis `opacity: 1`. On démonte les particules une ou deux frames après, pour éviter un flash.
- **À vérifier :** la capture d'une vue à opacity 0 peut sortir vide sur iOS. Contournement : opacity 0.01, ou un cache de la couleur du fond pendant une frame.
- Android demande `collapsable={false}`.
- Difficulté **S/M**.

---

## 5. `scrub` : désintégration au doigt, réversible

**Pitch.** On tire la carte avec le doigt et elle se désagrège exactement sous le doigt. On lâche avant le seuil et tout se réassemble avec un ressort. Les vibrations suivent la densité du contenu (le texte « crépite », les zones vides sont silencieuses).

**Cas d'usage.** Supprimer une conversation, rejeter une suggestion, « glisser pour effacer » un brouillon. La réversibilité rend le geste sûr.

**Maths.**
- N'importe quel preset marche, puisque tout est fonction de `p`.
- Avec `dust`, on place le front sous le doigt : `p = clamp(fingerX/w*0.62 + 0.1, 0, END)`.
- Release : si `p > 0.55*END` ou `vx > 800`, on lance `withTiming(END)` pour le reste de la durée. Sinon, `withSpring(0, { damping: 18, stiffness: 180 })`.
- La vue réelle a `opacity = p > 0.001 ? 0 : 1` (`useAnimatedStyle`).

**Haptique par densité.**
- Côté JS, une seule fois : on dessine la capture dans une surface de `cols × rows`, puis `readPixels`. On en tire `ink[col]` = l'écart de luminance par rapport à la médiane (le fond).
- Dans `useAnimatedReaction(progress)` :
  - colonne du front : `c = floor((p-0.1)/0.62*cols)` ;
  - on additionne `ink` des colonnes franchies ;
  - si l'accumulateur dépasse un seuil et qu'au moins 30 ms ont passé, on fait `scheduleOnRN(selectionAsync)` ;
  - colonne très dense : `impactAsync(Light)`.
- En marche arrière, on garde des ticks plus secs.

**API.**
```ts
const { ref, gesture } = useDissolveScrub({ preset: 'dust', axis: 'x', threshold: 0.55, onCommit });
<GestureDetector gesture={gesture}><View ref={ref} /></GestureDetector>
```

**Faisabilité.**
- Le refactor 0.2 suffit.
- Lancer la capture dans `onBegin` : elle est asynchrone et prend environ 16 à 30 ms. Il faut le masquer, soit en ne commençant le scrub qu'après 8 pt de pan, soit en pré-capturant au touch down.
- Ajoute `react-native-gesture-handler` en peer dependency optionnelle.
- Difficulté **M**. Pas plus, parce que le moteur est déjà stateless.

---

## 6. `charge` : maintenir pour détruire

**Pitch.**
- **Pendant l'appui :** la vue tremble, ses bords s'effilochent, elle chauffe vers l'orange et les vibrations accélèrent.
- **À 100 % :** elle explose depuis le doigt.
- **Lâcher avant :** tout se calme et se remet en place.

**Cas d'usage.** « Maintenir pour supprimer mon compte », effacer l'historique, message éphémère « burn after reading », casser une série dans une app d'habitudes.

**Maths.**
- Entrées : `charge` c ∈ [0, 1] (`withTiming(1, 1200 ms)` tant que c'est appuyé), `clock` (`useFrameCallback`) et le point de toucher.
- Pré-phase, avec `t = 0` :

```
A = c*c*2.5
cx += sin(clock*0.05 + r4*6.28)*A; cy += cos(clock*0.047 + r2*6.28)*A
edge = min(lx, w-lx, ly, h-ly)
if (edge < c*12) { cx += outward*(c*6)*r3; a = 0.85 }
g = 1 - 0.35*c*c; b = 1 - 0.8*c*c       // chauffe (modulate)
```

- À c = 1 : on bascule sur `snap` avec `origin = touch` et `push *= 1.4`, plus un `impactAsync(Heavy)`.
- Pendant la charge, l'intervalle entre ticks passe de 120 ms à 30 ms.

**API.** `const { ref, gesture } = useDissolveHold({ holdMs: 1200, then: 'snap', onCommit })`

**Faisabilité.**
- Atlas, mais avec un shared value d'horloge qui force un recalcul à chaque frame, même quand `p` ne bouge pas. Pas grave, ça ne dure que la charge.
- La capture se fait à l'appui.
- Difficulté **M**.

---

## 7. `cascade` : à l'échelle d'une liste ou d'un écran entier

**Pitch.** « Tout effacer » : toute l'inbox part en une vague diagonale ligne après ligne. Ou bien l'écran entier se désintègre au pop de navigation et révèle l'écran précédent dessous.

**Cas d'usage.** Vider les notifs, la corbeille ou le panier. Suppression de compte (l'écran de réglages se désagrège). Retour arrière dramatique, fin d'onboarding.

**Maths (mode liste).**
- Une seule capture du conteneur. On passe `rows` (les bornes Y des lignes, via `onLayout`). L'index de ligne de chaque grain est précalculé dans `data` (stride + 1).

```
delay = rowIdx*0.06 + (lx/w)*0.3 + r1*0.08     // ou sans rows : (ly/h)*0.45 + (lx/w)*0.25
```

  Le mouvement est celui d'un preset existant (`dust` ou `sand`).

**Mode écran.**
1. Capturer la racine de l'écran.
2. Ajouter le burst dans un provider placé au-dessus du navigator.
3. Faire immédiatement `router.back()` avec `animation: 'none'`. Le nouvel écran se trouve sous les grains.

**API.**
- `dissolve({ preset: 'dust', field: 'cascade', rows })`
- `const { dissolveScreen } = useDissolveScreen(); dissolveScreen({ preset: 'sand', then: () => router.back() })`

**Faisabilité, le point critique est le nombre de grains.**

| Taille | Grain | Nombre de grains |
|---|---|---|
| 390 × 844 | 3 pt | ≈ 36 600 (trop) |
| 390 × 844 | 6 pt | ≈ 9 200 |
| 390 × 844 | 8 pt | ≈ 5 100 |

- Règle à adopter : `grain = max(DEFAULT_GRAIN[preset], ceil(sqrt(w*h/10000)))`.
- Cumuler avec la suppression du color buffer décrite en section 0.
- Limites :
  - `makeImageFromView` ne capture ni carte, ni vidéo, ni blur, ni le liquid glass natif (NativeTabs) : zones vides ;
  - la status bar n'est pas capturée.
- Difficulté : **S** en mode liste, **M** en mode écran.

---

## 8. `shatter` : du verre brisé en triangles

**Pitch.** Impact au doigt, fissures radiales, puis de vrais éclats triangulaires qui tournent en pseudo-3D, accrochent la lumière et tombent sous la gravité.

**Cas d'usage.**
- Déverrouiller Pro : le cadenas ou le flou du paywall vole en éclats et révèle le contenu.
- Supprimer une photo.
- Game over, « briser la glace » dans une app sociale.

**Maths.**
- Ce n'est pas de l'Atlas. On utilise `<Vertices mode="triangles">`, avec un `ImageShader` de la capture et des `textures` en coordonnées pixel de l'image.
- Maillage polaire précalculé en JS autour de l'impact :
  - anneaux aux rayons 12, 30, 60, 110, 180, … ;
  - 10 à 14 secteurs, angles jitterés ;
  - chaque cellule devient 2 triangles, découpés au rect.
- Cela fait 150 à 300 éclats. Pour chacun : centroïde `g`, offsets des 3 sommets `(ax, ay)`, et r1..r4.

```
dir = norm(g-o); dn = |g-o|/maxD
delay = dn*0.15 + r1*0.05; life = 0.85
gap = t<0.08 ? 1.5*t/0.08 : 1.5                  // les fissures apparaissent
T = t*durSec*life
v0 = dir*(120 + r2*200)*(1 - 0.6dn)
pos = g + dir*gap + v0*T + (0, 0.5*900*T²)
ang = (r3-0.5)*6*t; fy = cos(r4*3*π*t)           // flip pseudo-3D
sommet = pos + R(ang)*(ax, ay*fy)
couleur sommet = 0.6 + 0.4*|fy| ; a = 1 - ss(max(0,(t-0.6)/0.4))
```

- Bonus : un `<Circle>` blanc à l'impact, qui grandit et s'efface.

**API.** `dissolve({ preset: 'shatter', origin: touch, shards: 200 })`

**Faisabilité.**
- `useDerivedValue` renvoie le tableau de points, environ 900 `SkPoint` par frame. C'est léger, bien moins coûteux qu'un Atlas de 5 000 grains.
- Port web : `clip()` sur le triangle, puis `drawImage` pour chaque éclat.
- Une seule capture. Difficulté **M**.

---

## 9. `morph` : une vue se réarrange en une autre

**Pitch.** Les grains de A s'envolent et se reposent pour composer B. L'appariement par luminance donne le fameux effet de pixel sorting.

**Cas d'usage.** « Suivre » devient « Abonné », changement d'avatar, carte prix vers sheet de checkout, bascule clair/sombre de tout l'écran (très viral, très lourd).

**Maths.**
- Entrées : deux captures, A (maintenant) et B (rendue cachée après le changement d'état).
- On calcule la luminance par grain des deux, via `readPixels` sur une grille réduite.
- On trie A et B par luminance et on apparie rang par rang : `j = floor(rank*nB/nA)`.

```
delay = r1*0.3 + lumRank*0.2; life = 0.6
u = ss(t); P1 = mid(PA,PB) + perp*(r3-0.5)*80
pos = bézier(PA, P1, PB, u); s = 1 + 0.3*sin(π*t)
cross = ss(clamp((t-0.3)/0.4))
Atlas A : alpha 1-cross ; Atlas B : mêmes transforms, sprites de B, alpha cross
```

**API.** `const { refA, refB, morph } = useDissolveMorph(); morph({ preset: 'sort' })`

**Faisabilité.**
- Deux captures, deux Atlas (deux fois le coût), et des tailles différentes à gérer.
- Il faut capturer B avant qu'il soit visible : même risque qu'en section 4.
- Difficulté **L**.

---

## Classement : « wow en vidéo X de 10 s » × « livrable en un week-end »

| # | Variante | Wow /10 | Week-end /10 | Score |
|---|---|---|---|---|
| 1 | `stream` (+ entrée depuis une source) | 9 | 9 | 81 |
| 2 | `scrub` (+ haptique par densité) | 9 | 8 | 72 |
| 3 | `snap` (+ `origin` générique) | 7 | 10 | 70 |
| 4 | `assemble` | 7 | 9 | 63 |
| 5 | `cascade` (mode liste) | 8 | 7 | 56 |
| 6 | `shatter` | 9 | 6 | 54 |
| 7 | `fling` | 6 | 9 | 54 |
| 8 | `charge` | 8 | 6 | 48 |
| 9 | `morph` | 10 | 3 | 30 |

## Mes 3 à construire en premier

1. **`stream`.** C'est le plus lisible en vidéo : l'objet va visiblement quelque part et le badge rebondit. Le même code fait sortie et entrée (bulle qui sort du bouton Envoyer), ce qui couvre aussi la demande « entrées ».
2. **`scrub`.** Un effet qu'on contrôle au doigt et qui se réassemble au relâché, c'est ce qui fait dire « attends, c'est en temps réel ? ». Il ne demande que le refactor `progress` externe, et l'haptique par densité est la signature propre à la lib.
3. **`snap` avec `origin`.** Une demi-journée de travail. Il démultiplie les 5 presets existants (n'importe quel preset part du doigt ou d'un bord), et il pose la base de `fling`, `charge` et `shatter`.

Ensuite, garder **`shatter`** comme pièce maîtresse d'une seconde vidéo (déverrouillage du paywall en éclats), et **`cascade` mode liste** pour la démo « Tout effacer ».