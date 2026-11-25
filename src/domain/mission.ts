export const stages = [
  {
    id: 'besoin',
    title: 'Comprendre le besoin',
    place: 'Kiosque',
    role: 'Enquête et conception',
    prompt: 'Des élèves ratent l’annonce des ateliers du midi. Tu prépares un service pour les aider. Par quoi commences-tu ?',
    options: [
      { label: 'Demander à quelques élèves comment ils découvrent les ateliers.', feedback: 'Bien vu. Observer les usages aide à savoir où l’information se perd et ce qui serait utile.', advance: true },
      { label: 'Choisir immédiatement les couleurs de l’application.', feedback: 'Les couleurs viendront ensuite. Il faut d’abord comprendre où l’information se perd.', advance: false },
      { label: 'Créer un compte pour chaque élève.', feedback: 'Un compte demande des données et du temps. Vérifie d’abord si les élèves en ont besoin.', advance: false },
    ],
  },
  {
    id: 'interface',
    title: 'Concevoir une interface',
    place: 'Atelier',
    role: 'Design d’interface',
    prompt: 'Le besoin est clair. Les élèves veulent savoir en un coup d’œil où et quand se tient un atelier. Quel prototype proposes-tu ?',
    options: [
      { label: 'Une affiche animée qui change à chaque seconde.', feedback: 'Le mouvement peut gêner la lecture. Cherche une façon stable de présenter le lieu et l’heure.', advance: false },
      { label: 'Une liste lisible avec le nom, le lieu et l’heure de chaque atelier.', feedback: 'C’est une base testable. Une présentation claire aide à retrouver les informations sur un petit écran.', advance: true },
      { label: 'Une page avec seulement une photo de chaque atelier.', feedback: 'Les photos peuvent aider, mais elles ne donnent pas toujours le lieu et l’heure.', advance: false },
    ],
  },
  {
    id: 'test',
    title: 'Tester et améliorer',
    place: 'Point de test',
    role: 'Développement et qualité',
    prompt: 'Le premier prototype fonctionne sur ton écran. Comment repères-tu ce qui reste difficile pour les élèves ?',
    options: [
      { label: 'Publier la version dès maintenant.', feedback: 'Ton écran ne couvre qu’une situation. Un essai avec plusieurs élèves peut faire ressortir d’autres obstacles.', advance: false },
      { label: 'Demander seulement si la page est jolie.', feedback: 'L’apparence compte. Observe aussi si les élèves trouvent réellement les informations qu’ils cherchent.', advance: false },
      { label: 'Faire chercher un atelier sur mobile et au clavier, puis relever les obstacles.', feedback: 'Exact. Observer une tâche réelle dans plusieurs conditions aide à améliorer la page.', advance: true },
    ],
  },
] as const

export type Stage = (typeof stages)[number]
export type StageId = Stage['id']

export const reflectionFields = [
  { key: 'interest', label: 'Qu’est-ce qui m’a intéressé ?', hint: 'Ex. comprendre un besoin, dessiner un écran ou tester une idée' },
  { key: 'constraint', label: 'Quelle contrainte compte pour moi ?', hint: 'Ex. temps de trajet, budget ou rythme de travail' },
  { key: 'skill', label: 'Quelle compétence ai-je envie d’essayer ?', hint: 'Ex. expliquer un choix, prototyper ou organiser un test' },
] as const

export type ReflectionKey = (typeof reflectionFields)[number]['key']
export type Reflection = Record<ReflectionKey, string>
export const reflectionLimit = 400

export function completeStage(completed: readonly StageId[], id: StageId): StageId[] {
  return stages[completed.length]?.id === id ? [...completed, id] : [...completed]
}

export function isMissionComplete(completed: readonly StageId[]): boolean {
  return completed.length === stages.length && stages.every((stage, index) => stage.id === completed[index])
}

export function emptyReflection(): Reflection {
  return { interest: '', constraint: '', skill: '' }
}

export function hasReflection(reflection: Reflection): boolean {
  return reflectionFields.some(({ key }) => reflection[key].trim().length > 0)
}
