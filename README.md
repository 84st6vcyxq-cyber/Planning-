# Planning 5x8 — V4

Pourquoi “Nuit” devient “Repos” sur certains mois ?
- Très souvent: **décalage d'un jour** lié aux dates locales (DST / changements d'heure) et aux calculs en millisecondes.
- V4 calcule l'écart en jours via un **compteur de jours UTC** => plus de dérive selon les mois.

Notes:
- Les 15 minutes en fin de poste sont comptées en **HS auto** (+0h15/jour travaillé).
- Tu peux ajouter des HS manuellement par jour (en plus).
