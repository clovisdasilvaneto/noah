export type Lang = 'pt' | 'en' | 'es' | 'de'

export const LANGS: { code: Lang; name: string; hint: string }[] = [
  { code: 'pt', name: 'Português', hint: 'Toque para jogar' },
  { code: 'en', name: 'English', hint: 'Tap to play' },
  { code: 'es', name: 'Español', hint: 'Toca para jugar' },
  { code: 'de', name: 'Deutsch', hint: 'Tippen zum Spielen' },
]

export type NpcId = 'wife' | 'shem' | 'ham' | 'japheth' | 'villagerA' | 'villagerB'

export type Line = { speaker: 'narrator' | 'god'; ref: string; text: string }

type Strings = {
  chooseLanguage: string
  gameTitle: string
  gameSubtitle: string
  play: string
  chapter: string
  chapterCallTitle: string
  chapterGatherTitle: string
  tapToContinue: string
  skip: string
  narrator: string
  god: string
  bibleSource: string
  callLines: Line[]
  afterCall: Line
  finalVerse: Line
  objWood: string
  objCauldron: string
  objPitch: string
  objKeel: string
  promptChop: string
  promptSmash: string
  promptBuild: string
  promptNeedMaterials: string
  toastWood: string
  toastPitch: string
  toastCauldron: string
  toastKeel: string
  studs: string
  faithMeter: string
  faithful: string
  paused: string
  resume: string
  restart: string
  language: string
  levelComplete: string
  comingSoon: string
  playAgain: string
  continue: string
  controlsDesktop: string
  controlsTouch: string
  jump: string
  action: string
  pause: string
  sound: string
  soundOn: string
  soundOff: string
  objPlanks: string
  objDecks: string
  objCoat: string
  objRoof: string
  objDoor: string
  promptCoat: string
  toastPlankPick: string
  toastPlank: string
  toastDecks: [string, string, string]
  toastCoat: string
  toastCoatDone: string
  toastRoof: string
  toastArk: string
  completeArk: string
  /** Noah's family hint for each gather step (0 wood … 9 done); two variants per step */
  hints: [string, string][]
  npcNames: Record<NpcId, string>
  npcLines: Record<NpcId, string[]>
}

const en: Strings = {
  chooseLanguage: 'Choose your language',
  gameTitle: "Noah's Ark",
  gameSubtitle: 'Brick by Brick',
  play: 'Play',
  chapter: 'Chapter',
  chapterCallTitle: 'God Speaks to Noah',
  chapterGatherTitle: 'Gopher Wood and Pitch',
  tapToContinue: 'Tap to continue',
  skip: 'Skip',
  narrator: 'Narrator',
  god: 'God',
  bibleSource: 'Berean Standard Bible (BSB)',
  callLines: [
    { speaker: 'narrator', ref: 'Genesis 6:9', text: 'This is the account of Noah. Noah was a righteous man, blameless in his generation; Noah walked with God.' },
    { speaker: 'god', ref: 'Genesis 6:13', text: 'The end of all living creatures has come before Me, because through them the earth is full of violence. Now behold, I will destroy both them and the earth.' },
    { speaker: 'god', ref: 'Genesis 6:14', text: 'Make for yourself an ark of gopher wood; make rooms in the ark and coat it with pitch inside and out.' },
    { speaker: 'god', ref: 'Genesis 6:15', text: 'And this is how you are to build it: The ark is to be 300 cubits long, 50 cubits wide, and 30 cubits high.' },
    { speaker: 'god', ref: 'Genesis 6:16', text: 'You are to make a roof for the ark, finish its walls a cubit from the top, place a door in the side of the ark, and build lower, middle, and upper decks.' },
    { speaker: 'god', ref: 'Genesis 6:17', text: 'And behold, I will bring floodwaters upon the earth to destroy every creature under the heavens that has the breath of life. Everything on the earth will perish.' },
    { speaker: 'god', ref: 'Genesis 6:18', text: 'But I will establish My covenant with you, and you will enter the ark—you and your sons and your wife and your sons’ wives with you.' },
    { speaker: 'god', ref: 'Genesis 6:19–20', text: 'And you are to bring two of every living creature into the ark—male and female—to keep them alive with you. Two of every kind of bird and animal and crawling creature will come to you to be kept alive.' },
    { speaker: 'god', ref: 'Genesis 6:21', text: 'You are also to take for yourself every kind of food that is eaten and gather it as food for yourselves and for the animals.' },
  ],
  afterCall: { speaker: 'narrator', ref: '', text: 'Noah got up early. There was gopher wood to cut and pitch to prepare. Help Noah obey God!' },
  finalVerse: { speaker: 'narrator', ref: 'Genesis 6:22', text: 'So Noah did everything precisely as God had commanded him.' },
  objWood: 'Chop gopher wood',
  objCauldron: 'Build the pitch cauldron',
  objPitch: 'Collect pitch',
  objKeel: 'Build the ark’s keel',
  promptChop: 'Chop',
  promptSmash: 'Smash',
  promptBuild: 'Hold to build',
  promptNeedMaterials: 'Gather the wood and pitch first',
  toastWood: '+1 Gopher wood',
  toastPitch: '+1 Pitch',
  toastCauldron: 'The pitch is bubbling!',
  toastKeel: 'The keel of the ark is laid!',
  studs: 'Studs',
  faithMeter: 'Faithful Servant',
  faithful: 'Faithful Servant!',
  paused: 'Paused',
  resume: 'Resume',
  restart: 'Restart chapter',
  language: 'Language',
  levelComplete: 'Chapter complete!',
  comingSoon: 'Next: Building the ark — coming soon',
  playAgain: 'Play again',
  continue: 'Continue',
  controlsDesktop: 'Move: WASD / Arrows · Jump: Space · Action: E (hold to build)',
  controlsTouch: 'Left thumb moves · ✋ action (hold to build) · ⤒ jump',
  jump: 'Jump',
  action: 'Action',
  pause: 'Pause',
  sound: 'Sound',
  soundOn: 'On',
  soundOff: 'Off',
  objPlanks: 'Carry planks to the ark',
  objDecks: 'Build the three decks',
  objCoat: 'Coat it with pitch, inside and out',
  objRoof: 'Build the roof and window',
  objDoor: 'Put the door in the side',
  promptCoat: 'Hold to coat with pitch',
  toastPlankPick: 'Planks! Carry them to the ark',
  toastPlank: '+1 Planks',
  toastDecks: ['Lower deck built!', 'Second deck built!', 'Third deck built!'],
  toastCoat: 'Sealed with pitch!',
  toastCoatDone: 'Pitch inside and out. No leaks!',
  toastRoof: 'The roof and window are on!',
  toastArk: 'The ark is finished!',
  completeArk: 'The ark is built: 300 cubits long, 50 wide and 30 high!',
  hints: [
    ['Look for the trees with the golden sparkle!', 'Chop each gopher tree three times.'],
    ['Now build the pitch cauldron by the village.', 'Hold the button to build the cauldron!'],
    ['Grab the pitch jars around the cauldron!', 'We need three jars of pitch.'],
    ['Everything is ready. Build the keel at the ark site!', 'The keel is the backbone of the ark.'],
    ['Carry planks from the woodpile by the forest!', 'Bring three loads of planks to the ark.'],
    ['God said: a lower, a second and a third deck!', 'Make rooms in the ark for all the animals.'],
    ['Smear pitch on the ark so no water gets in!', 'Inside and out, just like God said.'],
    ['Now the roof! Leave a window a cubit high under it.', 'The window lets the light in!'],
    ['The door goes in the side of the ark.', 'The animals will walk in through the door!'],
    ['The ark is finished! God is faithful.', 'What a big boat!'],
  ],
  npcNames: { wife: "Noah's wife", shem: 'Shem', ham: 'Ham', japheth: 'Japheth', villagerA: 'Villager', villagerB: 'Villager' },
  npcLines: {
    wife: ['The pitch will keep the ark dry, inside and out!', 'God has a plan for our family.'],
    shem: ['Father, the keel goes right here!', 'Bring the wood and the pitch, then we can build.'],
    ham: ['Look for the trees with the golden sparkle. That is gopher wood!', 'Chop each tree three times!'],
    japheth: ['Two of every kind of animal… that is a lot of animals!', 'The ark must be 300 cubits long!'],
    villagerA: ['A boat? Here, so far from the sea?', 'Noah says God told him to build it…'],
    villagerB: ['Smash my old crates if you like. You might find studs!', 'Why would anyone need such a big boat?'],
  },
}

const pt: Strings = {
  chooseLanguage: 'Escolha seu idioma',
  gameTitle: 'A Arca de Noé',
  gameSubtitle: 'Bloco por Bloco',
  play: 'Jogar',
  chapter: 'Capítulo',
  chapterCallTitle: 'Deus fala com Noé',
  chapterGatherTitle: 'Madeira de Gofer e Betume',
  tapToContinue: 'Toque para continuar',
  skip: 'Pular',
  narrator: 'Narrador',
  god: 'Deus',
  bibleSource: 'Almeida Revista e Corrigida, 1911 (ortografia atualizada)',
  callLines: [
    { speaker: 'narrator', ref: 'Gênesis 6:9', text: 'Estas são as gerações de Noé: Noé era varão justo e reto em suas gerações: Noé andava com Deus.' },
    { speaker: 'god', ref: 'Gênesis 6:13', text: 'O fim de toda a carne é vindo perante a minha face; porque a terra está cheia de violência; e eis que os desfarei com a terra.' },
    { speaker: 'god', ref: 'Gênesis 6:14', text: 'Faze para ti uma arca da madeira de gofer: farás compartimentos na arca, e a betumarás por dentro e por fora com betume.' },
    { speaker: 'god', ref: 'Gênesis 6:15', text: 'E desta maneira a farás: de trezentos côvados o comprimento da arca, e de cinquenta côvados a sua largura, e de trinta côvados a sua altura.' },
    { speaker: 'god', ref: 'Gênesis 6:16', text: 'Farás na arca uma janela, e de um côvado a acabarás em cima; e a porta da arca porás ao seu lado; far-lhe-ás andares baixos, segundos e terceiros.' },
    { speaker: 'god', ref: 'Gênesis 6:17', text: 'Porque eis que eu trago um dilúvio de águas sobre a terra, para desfazer toda a carne em que há espírito de vida debaixo dos céus: tudo o que há na terra expirará.' },
    { speaker: 'god', ref: 'Gênesis 6:18', text: 'Mas contigo estabelecerei o meu pacto; e entrarás na arca tu e os teus filhos, e a tua mulher, e as mulheres de teus filhos contigo.' },
    { speaker: 'god', ref: 'Gênesis 6:19–20', text: 'E de tudo o que vive, de toda a carne, dois de cada espécie, meterás na arca, para os conservar vivos contigo; macho e fêmea serão. Das aves conforme a sua espécie, e das bestas conforme a sua espécie, de todo o réptil da terra conforme a sua espécie, dois de cada espécie virão a ti, para os conservar em vida.' },
    { speaker: 'god', ref: 'Gênesis 6:21', text: 'E tu toma para ti de toda a comida que se come, e ajunta-a para ti; e te será para mantimento para ti e para eles.' },
  ],
  afterCall: { speaker: 'narrator', ref: '', text: 'Noé levantou cedo. Havia madeira de gofer para cortar e betume para preparar. Ajude Noé a obedecer a Deus!' },
  finalVerse: { speaker: 'narrator', ref: 'Gênesis 6:22', text: 'Assim fez Noé: conforme a tudo o que Deus lhe mandou, assim o fez.' },
  objWood: 'Corte madeira de gofer',
  objCauldron: 'Monte o caldeirão de betume',
  objPitch: 'Pegue o betume',
  objKeel: 'Monte a quilha da arca',
  promptChop: 'Cortar',
  promptSmash: 'Quebrar',
  promptBuild: 'Segure para montar',
  promptNeedMaterials: 'Junte a madeira e o betume primeiro',
  toastWood: '+1 Madeira de gofer',
  toastPitch: '+1 Betume',
  toastCauldron: 'O betume está fervendo!',
  toastKeel: 'A quilha da arca está pronta!',
  studs: 'Pinos',
  faithMeter: 'Servo Fiel',
  faithful: 'Servo Fiel!',
  paused: 'Pausado',
  resume: 'Continuar',
  restart: 'Reiniciar capítulo',
  language: 'Idioma',
  levelComplete: 'Capítulo concluído!',
  comingSoon: 'Próximo: Construindo a arca — em breve',
  playAgain: 'Jogar de novo',
  continue: 'Continuar',
  controlsDesktop: 'Mover: WASD / Setas · Pular: Espaço · Ação: E (segure para montar)',
  controlsTouch: 'Polegar esquerdo move · ✋ ação (segure para montar) · ⤒ pular',
  jump: 'Pular',
  action: 'Ação',
  pause: 'Pausar',
  sound: 'Som',
  soundOn: 'Ligado',
  soundOff: 'Desligado',
  objPlanks: 'Leve tábuas até a arca',
  objDecks: 'Construa os três andares',
  objCoat: 'Passe betume por dentro e por fora',
  objRoof: 'Faça o telhado e a janela',
  objDoor: 'Ponha a porta ao lado da arca',
  promptCoat: 'Segure para passar betume',
  toastPlankPick: 'Tábuas! Leve até a arca',
  toastPlank: '+1 Tábuas',
  toastDecks: ['Andar de baixo pronto!', 'Segundo andar pronto!', 'Terceiro andar pronto!'],
  toastCoat: 'Betume passado!',
  toastCoatDone: 'Betume por dentro e por fora. Nada de vazamento!',
  toastRoof: 'O telhado e a janela estão prontos!',
  toastArk: 'A arca está pronta!',
  completeArk: 'A arca está pronta: 300 côvados de comprimento, 50 de largura e 30 de altura!',
  hints: [
    ['Procure as árvores com o brilho dourado!', 'Corte cada árvore de gofer três vezes.'],
    ['Agora monte o caldeirão de betume perto da vila.', 'Segure o botão para montar o caldeirão!'],
    ['Pegue os potes de betume em volta do caldeirão!', 'Precisamos de três potes de betume.'],
    ['Tudo pronto. Monte a quilha no lugar da arca!', 'A quilha é a espinha da arca.'],
    ['Leve as tábuas da pilha de madeira perto da floresta!', 'Traga três cargas de tábuas para a arca.'],
    ['Deus disse: andares baixos, segundos e terceiros!', 'Faça compartimentos para todos os animais.'],
    ['Passe betume na arca para a água não entrar!', 'Por dentro e por fora, como Deus mandou.'],
    ['Agora o telhado! Deixe uma janela de um côvado embaixo dele.', 'A janela deixa a luz entrar!'],
    ['A porta fica ao lado da arca.', 'Os animais vão entrar pela porta!'],
    ['A arca está pronta! Deus é fiel.', 'Que barco enorme!'],
  ],
  npcNames: { wife: 'Esposa de Noé', shem: 'Sem', ham: 'Cam', japheth: 'Jafé', villagerA: 'Aldeão', villagerB: 'Aldeã' },
  npcLines: {
    wife: ['O betume vai deixar a arca seca, por dentro e por fora!', 'Deus tem um plano para a nossa família.'],
    shem: ['Pai, a quilha fica bem aqui!', 'Traga a madeira e o betume, aí podemos construir.'],
    ham: ['Procure as árvores com o brilho dourado. É madeira de gofer!', 'Corte cada árvore três vezes!'],
    japheth: ['Dois de cada espécie de animal… são muitos animais!', 'A arca precisa ter trezentos côvados!'],
    villagerA: ['Um barco? Aqui, tão longe do mar?', 'Noé diz que Deus mandou construir…'],
    villagerB: ['Pode quebrar meus caixotes velhos. Talvez ache pinos!', 'Para que alguém precisa de um barco tão grande?'],
  },
}

const es: Strings = {
  chooseLanguage: 'Elige tu idioma',
  gameTitle: 'El Arca de Noé',
  gameSubtitle: 'Bloque a Bloque',
  play: 'Jugar',
  chapter: 'Capítulo',
  chapterCallTitle: 'Dios habla con Noé',
  chapterGatherTitle: 'Madera de Gofer y Brea',
  tapToContinue: 'Toca para continuar',
  skip: 'Saltar',
  narrator: 'Narrador',
  god: 'Dios',
  bibleSource: 'Reina-Valera 1909',
  callLines: [
    { speaker: 'narrator', ref: 'Génesis 6:9', text: 'Estas son las generaciones de Noé: Noé, varón justo, perfecto fue en sus generaciones; con Dios caminó Noé.' },
    { speaker: 'god', ref: 'Génesis 6:13', text: 'El fin de toda carne ha venido delante de mí; porque la tierra está llena de violencia a causa de ellos; y he aquí que yo los destruiré con la tierra.' },
    { speaker: 'god', ref: 'Génesis 6:14', text: 'Hazte un arca de madera de Gofer: harás aposentos en el arca, y la embetunarás con brea por dentro y por fuera.' },
    { speaker: 'god', ref: 'Génesis 6:15', text: 'Y de esta manera la harás: de trescientos codos la longitud del arca, de cincuenta codos su anchura, y de treinta codos su altura.' },
    { speaker: 'god', ref: 'Génesis 6:16', text: 'Una ventana harás al arca, y la acabarás a un codo de elevación por la parte de arriba: y pondrás la puerta del arca a su lado; y le harás piso bajo, segundo y tercero.' },
    { speaker: 'god', ref: 'Génesis 6:17', text: 'Y yo, he aquí que yo traigo un diluvio de aguas sobre la tierra, para destruir toda carne en que haya espíritu de vida debajo del cielo; todo lo que hay en la tierra morirá.' },
    { speaker: 'god', ref: 'Génesis 6:18', text: 'Mas estableceré mi pacto contigo, y entrarás en el arca tú, y tus hijos y tu mujer, y las mujeres de tus hijos contigo.' },
    { speaker: 'god', ref: 'Génesis 6:19–20', text: 'Y de todo lo que vive, de toda carne, dos de cada especie meterás en el arca, para que tengan vida contigo; macho y hembra serán. De las aves según su especie, y de las bestias según su especie, de todo reptil de la tierra según su especie, dos de cada especie entrarán contigo para que hayan vida.' },
    { speaker: 'god', ref: 'Génesis 6:21', text: 'Y toma contigo de toda vianda que se come, y allégala a ti; servirá de alimento para ti y para ellos.' },
  ],
  afterCall: { speaker: 'narrator', ref: '', text: 'Noé se levantó temprano. Había madera de gofer que cortar y brea que preparar. ¡Ayuda a Noé a obedecer a Dios!' },
  finalVerse: { speaker: 'narrator', ref: 'Génesis 6:22', text: 'E hízolo así Noé; hizo conforme a todo lo que Dios le mandó.' },
  objWood: 'Corta madera de gofer',
  objCauldron: 'Construye el caldero de brea',
  objPitch: 'Recoge la brea',
  objKeel: 'Construye la quilla del arca',
  promptChop: 'Cortar',
  promptSmash: 'Romper',
  promptBuild: 'Mantén para construir',
  promptNeedMaterials: 'Primero reúne la madera y la brea',
  toastWood: '+1 Madera de gofer',
  toastPitch: '+1 Brea',
  toastCauldron: '¡La brea está hirviendo!',
  toastKeel: '¡La quilla del arca está lista!',
  studs: 'Pivotes',
  faithMeter: 'Siervo Fiel',
  faithful: '¡Siervo Fiel!',
  paused: 'Pausa',
  resume: 'Continuar',
  restart: 'Reiniciar capítulo',
  language: 'Idioma',
  levelComplete: '¡Capítulo completado!',
  comingSoon: 'Siguiente: Construyendo el arca — próximamente',
  playAgain: 'Jugar otra vez',
  continue: 'Continuar',
  controlsDesktop: 'Mover: WASD / Flechas · Saltar: Espacio · Acción: E (mantén para construir)',
  controlsTouch: 'Pulgar izquierdo mueve · ✋ acción (mantén para construir) · ⤒ saltar',
  jump: 'Saltar',
  action: 'Acción',
  pause: 'Pausa',
  sound: 'Sonido',
  soundOn: 'Activado',
  soundOff: 'Desactivado',
  objPlanks: 'Lleva tablas al arca',
  objDecks: 'Construye los tres pisos',
  objCoat: 'Cúbrela de brea por dentro y por fuera',
  objRoof: 'Haz el techo y la ventana',
  objDoor: 'Pon la puerta al costado',
  promptCoat: 'Mantén para echar brea',
  toastPlankPick: '¡Tablas! Llévalas al arca',
  toastPlank: '+1 Tablas',
  toastDecks: ['¡Piso bajo listo!', '¡Segundo piso listo!', '¡Tercer piso listo!'],
  toastCoat: '¡Sellado con brea!',
  toastCoatDone: 'Brea por dentro y por fuera. ¡Sin goteras!',
  toastRoof: '¡El techo y la ventana están listos!',
  toastArk: '¡El arca está terminada!',
  completeArk: '¡El arca está lista: 300 codos de largo, 50 de ancho y 30 de alto!',
  hints: [
    ['¡Busca los árboles con el brillo dorado!', 'Corta cada árbol de gofer tres veces.'],
    ['Ahora construye el caldero de brea cerca del pueblo.', '¡Mantén el botón para construir el caldero!'],
    ['¡Recoge los tarros de brea alrededor del caldero!', 'Necesitamos tres tarros de brea.'],
    ['Todo está listo. ¡Construye la quilla donde va el arca!', 'La quilla es la columna del arca.'],
    ['¡Lleva tablas desde la pila de madera junto al bosque!', 'Trae tres cargas de tablas al arca.'],
    ['Dios dijo: ¡piso bajo, segundo y tercero!', 'Haz aposentos para todos los animales.'],
    ['¡Echa brea al arca para que no entre agua!', 'Por dentro y por fuera, como Dios dijo.'],
    ['¡Ahora el techo! Deja una ventana de un codo debajo.', '¡La ventana deja entrar la luz!'],
    ['La puerta va al costado del arca.', '¡Los animales entrarán por la puerta!'],
    ['¡El arca está terminada! Dios es fiel.', '¡Qué barco tan grande!'],
  ],
  npcNames: { wife: 'Esposa de Noé', shem: 'Sem', ham: 'Cam', japheth: 'Jafet', villagerA: 'Aldeano', villagerB: 'Aldeana' },
  npcLines: {
    wife: ['¡La brea mantendrá el arca seca, por dentro y por fuera!', 'Dios tiene un plan para nuestra familia.'],
    shem: ['¡Padre, la quilla va justo aquí!', 'Trae la madera y la brea, y podremos construir.'],
    ham: ['Busca los árboles con el brillo dorado. ¡Es madera de gofer!', '¡Corta cada árbol tres veces!'],
    japheth: ['Dos de cada especie de animal… ¡son muchísimos animales!', '¡El arca debe medir trescientos codos!'],
    villagerA: ['¿Un barco? ¿Aquí, tan lejos del mar?', 'Noé dice que Dios le mandó construirlo…'],
    villagerB: ['Rompe mis cajas viejas si quieres. ¡Quizás encuentres pivotes!', '¿Para qué querría alguien un barco tan grande?'],
  },
}

const de: Strings = {
  chooseLanguage: 'Wähle deine Sprache',
  gameTitle: 'Die Arche Noah',
  gameSubtitle: 'Stein auf Stein',
  play: 'Spielen',
  chapter: 'Kapitel',
  chapterCallTitle: 'Gott spricht zu Noah',
  chapterGatherTitle: 'Gopherholz und Harz',
  tapToContinue: 'Tippen zum Fortfahren',
  skip: 'Überspringen',
  narrator: 'Erzähler',
  god: 'Gott',
  bibleSource: 'Elberfelder Bibel (1871)',
  callLines: [
    { speaker: 'narrator', ref: '1. Mose 6,9', text: 'Dies ist die Geschichte Noahs: Noah war ein gerechter, vollkommener Mann unter seinen Zeitgenossen; Noah wandelte mit Gott.' },
    { speaker: 'god', ref: '1. Mose 6,13', text: 'Das Ende alles Fleisches ist vor mich gekommen; denn die Erde ist voll Gewalttat durch sie; und siehe, ich will sie verderben mit der Erde.' },
    { speaker: 'god', ref: '1. Mose 6,14', text: 'Mache dir eine Arche von Gopherholz; mit Kammern sollst du die Arche machen und sie von innen und von außen mit Harz verpichen.' },
    { speaker: 'god', ref: '1. Mose 6,15', text: 'Und also sollst du sie machen: Dreihundert Ellen sei die Länge der Arche, fünfzig Ellen ihre Breite und dreißig Ellen ihre Höhe.' },
    { speaker: 'god', ref: '1. Mose 6,16', text: 'Eine Lichtöffnung sollst du der Arche machen, und bis zu einer Elle sollst du sie fertigen von oben her; und die Tür der Arche sollst du in ihre Seite setzen; mit einem unteren, zweiten und dritten Stockwerk sollst du sie machen.' },
    { speaker: 'god', ref: '1. Mose 6,17', text: 'Denn ich, siehe, ich bringe die Wasserflut über die Erde, um alles Fleisch unter dem Himmel zu verderben, in welchem ein Hauch des Lebens ist; alles, was auf der Erde ist, soll verscheiden.' },
    { speaker: 'god', ref: '1. Mose 6,18', text: 'Aber mit dir will ich meinen Bund errichten, und du sollst in die Arche gehen, du und deine Söhne und dein Weib und die Weiber deiner Söhne mit dir.' },
    { speaker: 'god', ref: '1. Mose 6,19–20', text: 'Und von allem Lebendigen, von allem Fleische, zwei von jeglichem sollst du in die Arche bringen, um sie mit dir am Leben zu erhalten; ein Männliches und ein Weibliches sollen sie sein. Von dem Gevögel nach seiner Art und von dem Vieh nach seiner Art, von allem Gewürm des Erdbodens nach seiner Art: zwei von jeglichem sollen zu dir hineingehen, um sie am Leben zu erhalten.' },
    { speaker: 'god', ref: '1. Mose 6,21', text: 'Und du, nimm dir von aller Speise, die gegessen wird und sammle sie bei dir auf, daß sie dir und ihnen zur Nahrung sei.' },
  ],
  afterCall: { speaker: 'narrator', ref: '', text: 'Noah stand früh auf. Es gab Gopherholz zu schlagen und Harz vorzubereiten. Hilf Noah, Gott zu gehorchen!' },
  finalVerse: { speaker: 'narrator', ref: '1. Mose 6,22', text: 'Und Noah tat es; nach allem, was Gott ihm geboten hatte, also tat er.' },
  objWood: 'Fälle Gopherholz',
  objCauldron: 'Baue den Harzkessel',
  objPitch: 'Sammle Harz',
  objKeel: 'Baue den Kiel der Arche',
  promptChop: 'Hacken',
  promptSmash: 'Zerschlagen',
  promptBuild: 'Halten zum Bauen',
  promptNeedMaterials: 'Sammle zuerst Holz und Harz',
  toastWood: '+1 Gopherholz',
  toastPitch: '+1 Harz',
  toastCauldron: 'Das Harz brodelt!',
  toastKeel: 'Der Kiel der Arche ist gelegt!',
  studs: 'Noppen',
  faithMeter: 'Treuer Diener',
  faithful: 'Treuer Diener!',
  paused: 'Pause',
  resume: 'Weiter',
  restart: 'Kapitel neu starten',
  language: 'Sprache',
  levelComplete: 'Kapitel geschafft!',
  comingSoon: 'Als Nächstes: Der Bau der Arche — demnächst',
  playAgain: 'Nochmal spielen',
  continue: 'Weiter',
  controlsDesktop: 'Bewegen: WASD / Pfeile · Springen: Leertaste · Aktion: E (halten zum Bauen)',
  controlsTouch: 'Linker Daumen bewegt · ✋ Aktion (halten zum Bauen) · ⤒ springen',
  jump: 'Springen',
  action: 'Aktion',
  pause: 'Pause',
  sound: 'Ton',
  soundOn: 'An',
  soundOff: 'Aus',
  objPlanks: 'Trage Bretter zur Arche',
  objDecks: 'Baue die drei Stockwerke',
  objCoat: 'Verpiche sie innen und außen',
  objRoof: 'Baue das Dach und das Fenster',
  objDoor: 'Setze die Tür in die Seite',
  promptCoat: 'Halten zum Verpichen',
  toastPlankPick: 'Bretter! Trag sie zur Arche',
  toastPlank: '+1 Bretter',
  toastDecks: ['Unteres Stockwerk fertig!', 'Zweites Stockwerk fertig!', 'Drittes Stockwerk fertig!'],
  toastCoat: 'Mit Harz abgedichtet!',
  toastCoatDone: 'Harz innen und außen. Alles dicht!',
  toastRoof: 'Dach und Fenster sind fertig!',
  toastArk: 'Die Arche ist fertig!',
  completeArk: 'Die Arche ist gebaut: 300 Ellen lang, 50 breit und 30 hoch!',
  hints: [
    ['Such die Bäume mit dem goldenen Glitzern!', 'Schlag jeden Gopherbaum dreimal.'],
    ['Baue jetzt den Harzkessel beim Dorf.', 'Halte die Taste gedrückt, um den Kessel zu bauen!'],
    ['Sammle die Harztöpfe rund um den Kessel!', 'Wir brauchen drei Töpfe Harz.'],
    ['Alles ist bereit. Baue den Kiel am Bauplatz der Arche!', 'Der Kiel ist das Rückgrat der Arche.'],
    ['Trag Bretter vom Holzstapel beim Wald!', 'Bring drei Ladungen Bretter zur Arche.'],
    ['Gott sagte: ein unteres, ein zweites und ein drittes Stockwerk!', 'Bau Kammern für alle Tiere.'],
    ['Streich Harz auf die Arche, damit kein Wasser hineinkommt!', 'Innen und außen, wie Gott es gesagt hat.'],
    ['Jetzt das Dach! Lass darunter eine Elle hoch Platz für das Fenster.', 'Durch das Fenster kommt Licht herein!'],
    ['Die Tür kommt in die Seite der Arche.', 'Durch die Tür gehen später die Tiere hinein!'],
    ['Die Arche ist fertig! Gott ist treu.', 'Was für ein großes Schiff!'],
  ],
  npcNames: { wife: 'Noahs Frau', shem: 'Sem', ham: 'Ham', japheth: 'Jafet', villagerA: 'Dorfbewohner', villagerB: 'Dorfbewohnerin' },
  npcLines: {
    wife: ['Das Harz hält die Arche trocken, innen und außen!', 'Gott hat einen Plan für unsere Familie.'],
    shem: ['Vater, der Kiel kommt genau hierhin!', 'Bring das Holz und das Harz, dann können wir bauen.'],
    ham: ['Such die Bäume mit dem goldenen Glitzern. Das ist Gopherholz!', 'Schlag jeden Baum dreimal!'],
    japheth: ['Von jeder Tierart zwei… das sind viele Tiere!', 'Die Arche muss dreihundert Ellen lang sein!'],
    villagerA: ['Ein Schiff? Hier, so weit weg vom Meer?', 'Noah sagt, Gott hat es ihm befohlen…'],
    villagerB: ['Zerschlag ruhig meine alten Kisten. Vielleicht findest du Noppen!', 'Wer braucht denn so ein großes Schiff?'],
  },
}

export const STRINGS: Record<Lang, Strings> = { pt, en, es, de }
