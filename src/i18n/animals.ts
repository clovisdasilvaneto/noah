// Chapter 4 ("Gathering the Animals") UI text in all four languages.
// Scripture uses the same translations as strings.ts: EN BSB, PT Almeida,
// ES Reina-Valera 1909, DE Elberfelder 1871.
import type { Lang, Line } from './strings'

export type SpeciesId = 'lions' | 'elephants' | 'giraffes' | 'zebras' | 'sheep' | 'rabbits' | 'turtles' | 'doves'

export const SPECIES_ORDER: SpeciesId[] = ['lions', 'elephants', 'giraffes', 'zebras', 'sheep', 'rabbits', 'turtles', 'doves']

export const SPECIES_ICON: Record<SpeciesId, string> = {
  lions: '🦁',
  elephants: '🐘',
  giraffes: '🦒',
  zebras: '🦓',
  sheep: '🐑',
  rabbits: '🐇',
  turtles: '🐢',
  doves: '🕊️',
}

type SpeciesText = {
  /** plural name for the HUD */
  name: string
  /** action prompt next to the animals */
  prompt: string
  /** toast when the pair (or flock) is found */
  found: string
  /** toast when the last of them walks through the door */
  aboard: string
}

export type FamilyId = 'wife' | 'shem' | 'ham' | 'japheth'

type AnimalsStrings = {
  title: string
  objective: string
  objectiveDone: string
  pairsAboard: string
  species: Record<SpeciesId, SpeciesText>
  promptSmashLog: string
  promptLogFirst: string
  promptRingBell: string
  promptClimbBell: string
  promptBuildBridge: string
  promptSearchGrass: string
  promptCatch: string
  toastLogHit: string
  toastLogGone: string
  toastBridge: string
  toastBell: string
  toastEmptyGrass: string
  toastLionFound: string
  toastRabbitCaught: string
  toastSheepFound: string
  toastTurtlesWait: string
  toastClimb: string
  toastAllAboard: string
  controlsDesktop: string
  controlsTouch: string
  closingCaption: string
  resultsTitle: string
  resultsAnimals: string
  verse: Line
  familyLines: Record<FamilyId, string[]>
}

const en: AnimalsStrings = {
  title: 'Gathering the Animals',
  objective: 'Bring the animals to the ark',
  objectiveDone: 'Everyone is aboard!',
  pairsAboard: 'Aboard',
  species: {
    lions: { name: 'Lions', prompt: 'Call the lion', found: 'A lion! It follows you.', aboard: 'The lions are aboard!' },
    elephants: { name: 'Elephants', prompt: 'Call the elephants', found: 'The elephants are on their way!', aboard: 'The elephants are aboard!' },
    giraffes: { name: 'Giraffes', prompt: 'Call the giraffes', found: 'The giraffes are coming down!', aboard: 'The giraffes are aboard!' },
    zebras: { name: 'Zebras', prompt: 'Call the zebras', found: 'The zebras trot over the bridge!', aboard: 'The zebras are aboard!' },
    sheep: { name: 'Sheep', prompt: 'Call the sheep', found: 'A sheep follows you!', aboard: 'All the sheep are aboard!' },
    rabbits: { name: 'Rabbits', prompt: 'Catch the rabbit', found: 'Both rabbits! Off to the ark!', aboard: 'The rabbits are aboard!' },
    turtles: { name: 'Turtles', prompt: 'Call the turtles', found: 'The turtles follow you. Slowly!', aboard: 'The turtles are aboard!' },
    doves: { name: 'Doves', prompt: 'Ring the bell', found: 'The doves fly to the ark!', aboard: 'The doves are aboard!' },
  },
  promptSmashLog: 'Smash the log',
  promptLogFirst: 'Smash the log to let them out!',
  promptRingBell: 'Ring the bell',
  promptClimbBell: 'Climb up to ring the bell',
  promptBuildBridge: 'Build a bridge',
  promptSearchGrass: 'Look in the tall grass',
  promptCatch: 'Catch the rabbit',
  toastLogHit: 'Crack! Hit it again!',
  toastLogGone: 'The path is open!',
  toastBridge: 'Bridge built!',
  toastBell: 'Ding, ding! Here come the doves!',
  toastEmptyGrass: 'Nobody here…',
  toastLionFound: 'You found a lion!',
  toastRabbitCaught: 'Got one!',
  toastSheepFound: 'Sheep found',
  toastTurtlesWait: 'Too far! The turtles are waiting for you.',
  toastClimb: 'Climb the hill to reach them!',
  toastAllAboard: 'Every animal is aboard!',
  controlsDesktop: 'WASD move · Space jump · E call, smash, ring (hold E to build)',
  controlsTouch: 'Joystick to move · ⤒ jump · ✋ call, smash, ring (hold to build)',
  closingCaption: 'Then the LORD shut him in.',
  resultsTitle: 'All Aboard!',
  resultsAnimals: 'Animals aboard',
  verse: {
    speaker: 'narrator',
    ref: 'Genesis 7:16',
    text: 'And they entered, the male and female of every living thing, as God had commanded Noah. Then the LORD shut him in.',
  },
  familyLines: {
    wife: ['The rabbits hop away! Chase them into a corner.', 'The turtles are slow. Stay close so they keep walking.'],
    shem: ['The giraffes are up on the hill. Hop up the steps!', 'A fallen log blocks the elephants. Smash it!'],
    ham: ['The lions are hiding in the tall grass. Look for a tail!', 'Six sheep are lost in the fields. Find them all!'],
    japheth: ['The zebras are across the stream. Build them a bridge!', 'Ring the bell under the big tree to call the doves.'],
  },
}

const pt: AnimalsStrings = {
  title: 'Reunindo os Animais',
  objective: 'Leve os animais até a arca',
  objectiveDone: 'Todos estão na arca!',
  pairsAboard: 'Na arca',
  species: {
    lions: { name: 'Leões', prompt: 'Chamar o leão', found: 'Um leão! Ele segue você.', aboard: 'Os leões estão na arca!' },
    elephants: { name: 'Elefantes', prompt: 'Chamar os elefantes', found: 'Os elefantes estão a caminho!', aboard: 'Os elefantes estão na arca!' },
    giraffes: { name: 'Girafas', prompt: 'Chamar as girafas', found: 'As girafas estão descendo!', aboard: 'As girafas estão na arca!' },
    zebras: { name: 'Zebras', prompt: 'Chamar as zebras', found: 'As zebras atravessam a ponte!', aboard: 'As zebras estão na arca!' },
    sheep: { name: 'Ovelhas', prompt: 'Chamar a ovelha', found: 'Uma ovelha segue você!', aboard: 'Todas as ovelhas estão na arca!' },
    rabbits: { name: 'Coelhos', prompt: 'Pegar o coelho', found: 'Os dois coelhos! Para a arca!', aboard: 'Os coelhos estão na arca!' },
    turtles: { name: 'Tartarugas', prompt: 'Chamar as tartarugas', found: 'As tartarugas seguem você. Devagar!', aboard: 'As tartarugas estão na arca!' },
    doves: { name: 'Pombas', prompt: 'Tocar o sino', found: 'As pombas voam para a arca!', aboard: 'As pombas estão na arca!' },
  },
  promptSmashLog: 'Quebrar o tronco',
  promptLogFirst: 'Quebre o tronco para eles saírem!',
  promptRingBell: 'Tocar o sino',
  promptClimbBell: 'Suba para tocar o sino',
  promptBuildBridge: 'Construir uma ponte',
  promptSearchGrass: 'Procurar no capim alto',
  promptCatch: 'Pegar o coelho',
  toastLogHit: 'Crac! Bata de novo!',
  toastLogGone: 'O caminho está livre!',
  toastBridge: 'Ponte construída!',
  toastBell: 'Blém, blém! Lá vêm as pombas!',
  toastEmptyGrass: 'Ninguém aqui…',
  toastLionFound: 'Você achou um leão!',
  toastRabbitCaught: 'Peguei um!',
  toastSheepFound: 'Ovelhas achadas',
  toastTurtlesWait: 'Longe demais! As tartarugas esperam por você.',
  toastClimb: 'Suba o morro para chegar até elas!',
  toastAllAboard: 'Todos os animais estão na arca!',
  controlsDesktop: 'WASD andar · Espaço pular · E chamar, quebrar, tocar (segure E para construir)',
  controlsTouch: 'Joystick para andar · ⤒ pular · ✋ chamar, quebrar, tocar (segure para construir)',
  closingCaption: 'E o Senhor o fechou por fora.',
  resultsTitle: 'Todos a Bordo!',
  resultsAnimals: 'Animais na arca',
  verse: {
    speaker: 'narrator',
    ref: 'Gênesis 7:16',
    text: 'E os que entraram, macho e fêmea de toda a carne entraram, como Deus lhe tinha ordenado: e o Senhor o fechou por fora.',
  },
  familyLines: {
    wife: ['Os coelhos fogem pulando! Encurrale-os num canto.', 'As tartarugas são lentas. Fique perto para elas continuarem andando.'],
    shem: ['As girafas estão no alto do morro. Pule pelos degraus!', 'Um tronco caído prende os elefantes. Quebre-o!'],
    ham: ['Os leões se escondem no capim alto. Procure um rabo!', 'Seis ovelhas se perderam nos campos. Encontre todas!'],
    japheth: ['As zebras estão do outro lado do riacho. Construa uma ponte!', 'Toque o sino debaixo da árvore grande para chamar as pombas.'],
  },
}

const es: AnimalsStrings = {
  title: 'Reuniendo los Animales',
  objective: 'Lleva los animales al arca',
  objectiveDone: '¡Todos están en el arca!',
  pairsAboard: 'En el arca',
  species: {
    lions: { name: 'Leones', prompt: 'Llamar al león', found: '¡Un león! Te sigue.', aboard: '¡Los leones están en el arca!' },
    elephants: { name: 'Elefantes', prompt: 'Llamar a los elefantes', found: '¡Los elefantes ya vienen!', aboard: '¡Los elefantes están en el arca!' },
    giraffes: { name: 'Jirafas', prompt: 'Llamar a las jirafas', found: '¡Las jirafas bajan de la colina!', aboard: '¡Las jirafas están en el arca!' },
    zebras: { name: 'Cebras', prompt: 'Llamar a las cebras', found: '¡Las cebras cruzan el puente!', aboard: '¡Las cebras están en el arca!' },
    sheep: { name: 'Ovejas', prompt: 'Llamar a la oveja', found: '¡Una oveja te sigue!', aboard: '¡Todas las ovejas están en el arca!' },
    rabbits: { name: 'Conejos', prompt: 'Atrapar al conejo', found: '¡Los dos conejos! ¡Al arca!', aboard: '¡Los conejos están en el arca!' },
    turtles: { name: 'Tortugas', prompt: 'Llamar a las tortugas', found: 'Las tortugas te siguen. ¡Despacio!', aboard: '¡Las tortugas están en el arca!' },
    doves: { name: 'Palomas', prompt: 'Tocar la campana', found: '¡Las palomas vuelan al arca!', aboard: '¡Las palomas están en el arca!' },
  },
  promptSmashLog: 'Romper el tronco',
  promptLogFirst: '¡Rompe el tronco para que salgan!',
  promptRingBell: 'Tocar la campana',
  promptClimbBell: 'Sube para tocar la campana',
  promptBuildBridge: 'Construir un puente',
  promptSearchGrass: 'Buscar en la hierba alta',
  promptCatch: 'Atrapar al conejo',
  toastLogHit: '¡Crac! ¡Golpéalo otra vez!',
  toastLogGone: '¡El camino está libre!',
  toastBridge: '¡Puente construido!',
  toastBell: '¡Din, don! ¡Ahí vienen las palomas!',
  toastEmptyGrass: 'Aquí no hay nadie…',
  toastLionFound: '¡Encontraste un león!',
  toastRabbitCaught: '¡Atrapado!',
  toastSheepFound: 'Ovejas encontradas',
  toastTurtlesWait: '¡Muy lejos! Las tortugas te esperan.',
  toastClimb: '¡Sube la colina para alcanzarlas!',
  toastAllAboard: '¡Todos los animales están en el arca!',
  controlsDesktop: 'WASD mover · Espacio saltar · E llamar, romper, tocar (mantén E para construir)',
  controlsTouch: 'Joystick para mover · ⤒ saltar · ✋ llamar, romper, tocar (mantén para construir)',
  closingCaption: 'Y Jehová le cerró la puerta.',
  resultsTitle: '¡Todos a Bordo!',
  resultsAnimals: 'Animales en el arca',
  verse: {
    speaker: 'narrator',
    ref: 'Génesis 7:16',
    text: 'Y los que vinieron, macho y hembra de toda carne vinieron, como le había mandado Dios: y Jehová le cerró la puerta.',
  },
  familyLines: {
    wife: ['¡Los conejos se escapan saltando! Arrincónalos.', 'Las tortugas son lentas. Quédate cerca para que sigan caminando.'],
    shem: ['Las jirafas están en lo alto de la colina. ¡Sube por los escalones!', 'Un tronco caído encierra a los elefantes. ¡Rómpelo!'],
    ham: ['Los leones se esconden en la hierba alta. ¡Busca una cola!', 'Seis ovejas se perdieron en los campos. ¡Encuéntralas todas!'],
    japheth: ['Las cebras están al otro lado del arroyo. ¡Constrúyeles un puente!', 'Toca la campana bajo el árbol grande para llamar a las palomas.'],
  },
}

const de: AnimalsStrings = {
  title: 'Die Tiere sammeln',
  objective: 'Bring die Tiere zur Arche',
  objectiveDone: 'Alle sind an Bord!',
  pairsAboard: 'An Bord',
  species: {
    lions: { name: 'Löwen', prompt: 'Den Löwen rufen', found: 'Ein Löwe! Er folgt dir.', aboard: 'Die Löwen sind an Bord!' },
    elephants: { name: 'Elefanten', prompt: 'Die Elefanten rufen', found: 'Die Elefanten sind unterwegs!', aboard: 'Die Elefanten sind an Bord!' },
    giraffes: { name: 'Giraffen', prompt: 'Die Giraffen rufen', found: 'Die Giraffen kommen herunter!', aboard: 'Die Giraffen sind an Bord!' },
    zebras: { name: 'Zebras', prompt: 'Die Zebras rufen', found: 'Die Zebras traben über die Brücke!', aboard: 'Die Zebras sind an Bord!' },
    sheep: { name: 'Schafe', prompt: 'Das Schaf rufen', found: 'Ein Schaf folgt dir!', aboard: 'Alle Schafe sind an Bord!' },
    rabbits: { name: 'Hasen', prompt: 'Den Hasen fangen', found: 'Beide Hasen! Ab zur Arche!', aboard: 'Die Hasen sind an Bord!' },
    turtles: { name: 'Schildkröten', prompt: 'Die Schildkröten rufen', found: 'Die Schildkröten folgen dir. Langsam!', aboard: 'Die Schildkröten sind an Bord!' },
    doves: { name: 'Tauben', prompt: 'Die Glocke läuten', found: 'Die Tauben fliegen zur Arche!', aboard: 'Die Tauben sind an Bord!' },
  },
  promptSmashLog: 'Den Stamm zerschlagen',
  promptLogFirst: 'Zerschlag den Stamm, damit sie herauskönnen!',
  promptRingBell: 'Die Glocke läuten',
  promptClimbBell: 'Klettere hoch zur Glocke',
  promptBuildBridge: 'Eine Brücke bauen',
  promptSearchGrass: 'Im hohen Gras suchen',
  promptCatch: 'Den Hasen fangen',
  toastLogHit: 'Krach! Noch einmal!',
  toastLogGone: 'Der Weg ist frei!',
  toastBridge: 'Brücke gebaut!',
  toastBell: 'Bim, bam! Da kommen die Tauben!',
  toastEmptyGrass: 'Hier ist niemand…',
  toastLionFound: 'Du hast einen Löwen gefunden!',
  toastRabbitCaught: 'Gefangen!',
  toastSheepFound: 'Schafe gefunden',
  toastTurtlesWait: 'Zu weit weg! Die Schildkröten warten auf dich.',
  toastClimb: 'Klettere auf den Hügel, um sie zu erreichen!',
  toastAllAboard: 'Alle Tiere sind an Bord!',
  controlsDesktop: 'WASD laufen · Leertaste springen · E rufen, zerschlagen, läuten (E halten zum Bauen)',
  controlsTouch: 'Joystick zum Laufen · ⤒ springen · ✋ rufen, zerschlagen, läuten (halten zum Bauen)',
  closingCaption: 'Und Jehova schloß hinter ihm zu.',
  resultsTitle: 'Alle an Bord!',
  resultsAnimals: 'Tiere an Bord',
  verse: {
    speaker: 'narrator',
    ref: '1. Mose 7,16',
    text: 'Und die hineingingen, waren ein Männliches und ein Weibliches von allem Fleische, wie Gott ihm geboten hatte. Und Jehova schloß hinter ihm zu.',
  },
  familyLines: {
    wife: ['Die Hasen hoppeln davon! Treib sie in eine Ecke.', 'Die Schildkröten sind langsam. Bleib nah bei ihnen, dann laufen sie weiter.'],
    shem: ['Die Giraffen sind oben auf dem Hügel. Spring die Stufen hoch!', 'Ein umgestürzter Stamm sperrt die Elefanten ein. Zerschlag ihn!'],
    ham: ['Die Löwen verstecken sich im hohen Gras. Achte auf einen Schwanz!', 'Sechs Schafe haben sich auf den Feldern verirrt. Finde sie alle!'],
    japheth: ['Die Zebras sind auf der anderen Seite des Bachs. Bau ihnen eine Brücke!', 'Läute die Glocke unter dem großen Baum, um die Tauben zu rufen.'],
  },
}

export const ANIMALS_STRINGS: Record<Lang, AnimalsStrings> = { en, pt, es, de }
