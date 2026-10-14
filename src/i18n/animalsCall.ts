import type { Lang, Line } from './strings'

/**
 * Chapter 3 cutscene: God sends Noah into the ark with the animals (Genesis 7:1–5).
 * Same translations as the Chapter 1 lines:
 *   EN Berean Standard Bible, PT João Ferreira de Almeida, Revista e Corrigida 1911 (spelling modernised),
 *   ES Reina-Valera 1909 (accents modernised), DE Elberfelder 1871.
 * The first and last lines are narration (not scripture, so no ref).
 * Narration clips: `animals-call-${index}`.
 */
export const animalsCallLines: Record<Lang, Line[]> = {
  en: [
    {
      speaker: 'narrator',
      ref: '',
      text: 'Noah and his sons built the ark, brick by brick, just as God had said. Far away, storm clouds began to gather. Then the LORD spoke to Noah again.',
    },
    { speaker: 'god', ref: 'Genesis 7:1', text: 'Go into the ark, you and all your family, because I have found you righteous in this generation.' },
    {
      speaker: 'god',
      ref: 'Genesis 7:2–3',
      text: 'You are to take with you seven pairs of every kind of clean animal, a male and its mate; a pair of every kind of unclean animal, a male and its mate; and seven pairs of every kind of bird of the air, male and female, to preserve their offspring on the face of all the earth.',
    },
    {
      speaker: 'god',
      ref: 'Genesis 7:4',
      text: 'For seven days from now I will send rain on the earth for forty days and forty nights, and I will wipe from the face of the earth every living thing I have made.',
    },
    { speaker: 'narrator', ref: 'Genesis 7:5', text: 'And Noah did all that the LORD had commanded him.' },
    { speaker: 'narrator', ref: '', text: 'Look! On the horizon, the animals are coming, two by two. Help Noah lead them safely into the ark!' },
  ],
  pt: [
    {
      speaker: 'narrator',
      ref: '',
      text: 'Noé e seus filhos construíram a arca, bloco por bloco, como Deus tinha dito. Ao longe, nuvens de tempestade começaram a se juntar. Então o Senhor falou outra vez com Noé.',
    },
    { speaker: 'god', ref: 'Gênesis 7:1', text: 'Entra tu e toda a tua casa na arca: porque te hei visto justo diante de mim nesta geração.' },
    {
      speaker: 'god',
      ref: 'Gênesis 7:2–3',
      text: 'De todo o animal limpo tomarás para ti sete e sete, macho e sua fêmea; mas dos animais que não são limpos, dois, o macho e sua fêmea. Também das aves dos céus sete e sete, macho e fêmea, para conservar em vida a semente sobre a face de toda a terra.',
    },
    {
      speaker: 'god',
      ref: 'Gênesis 7:4',
      text: 'Porque, passados ainda sete dias, farei chover sobre a terra quarenta dias e quarenta noites; e desfarei de sobre a face da terra toda a substância que fiz.',
    },
    { speaker: 'narrator', ref: 'Gênesis 7:5', text: 'E fez Noé conforme a tudo o que o Senhor lhe ordenara.' },
    { speaker: 'narrator', ref: '', text: 'Veja! No horizonte, os animais estão chegando, de dois em dois. Ajude Noé a levá-los em segurança para a arca!' },
  ],
  es: [
    {
      speaker: 'narrator',
      ref: '',
      text: 'Noé y sus hijos construyeron el arca, bloque por bloque, tal como Dios había dicho. A lo lejos, comenzaron a juntarse nubes de tormenta. Entonces Jehová habló otra vez a Noé.',
    },
    { speaker: 'god', ref: 'Génesis 7:1', text: 'Entra tú y toda tu casa en el arca; porque a ti he visto justo delante de mí en esta generación.' },
    {
      speaker: 'god',
      ref: 'Génesis 7:2–3',
      text: 'De todo animal limpio te tomarás de siete en siete, macho y su hembra; mas de los animales que no son limpios, dos, macho y su hembra. También de las aves de los cielos de siete en siete, macho y hembra; para guardar en vida la casta sobre la faz de toda la tierra.',
    },
    {
      speaker: 'god',
      ref: 'Génesis 7:4',
      text: 'Porque pasados aún siete días, yo haré llover sobre la tierra cuarenta días y cuarenta noches; y raeré toda sustancia que hice de sobre la faz de la tierra.',
    },
    { speaker: 'narrator', ref: 'Génesis 7:5', text: 'E hizo Noé conforme a todo lo que le mandó Jehová.' },
    { speaker: 'narrator', ref: '', text: '¡Mira! En el horizonte vienen los animales, de dos en dos. ¡Ayuda a Noé a llevarlos a salvo al arca!' },
  ],
  de: [
    {
      speaker: 'narrator',
      ref: '',
      text: 'Noah und seine Söhne bauten die Arche, Stein für Stein, so wie Gott es gesagt hatte. In der Ferne zogen Sturmwolken auf. Da sprach Jehova wieder zu Noah.',
    },
    { speaker: 'god', ref: '1. Mose 7,1', text: 'Gehe in die Arche, du und dein ganzes Haus; denn dich habe ich gerecht vor mir erfunden in diesem Geschlecht.' },
    {
      speaker: 'god',
      ref: '1. Mose 7,2–3',
      text: 'Von allem reinen Vieh sollst du sieben und sieben zu dir nehmen, ein Männchen und sein Weibchen; und von dem Vieh, das nicht rein ist, zwei, ein Männchen und sein Weibchen; auch von dem Gevögel des Himmels sieben und sieben, ein Männliches und ein Weibliches: um Samen am Leben zu erhalten auf der Fläche der ganzen Erde.',
    },
    {
      speaker: 'god',
      ref: '1. Mose 7,4',
      text: 'Denn in noch sieben Tagen, so lasse ich auf die Erde regnen vierzig Tage und vierzig Nächte und werde vertilgen von der Fläche des Erdbodens alles Bestehende, das ich gemacht habe.',
    },
    { speaker: 'narrator', ref: '1. Mose 7,5', text: 'Und Noah tat nach allem, was Jehova ihm geboten hatte.' },
    { speaker: 'narrator', ref: '', text: 'Schau! Am Horizont kommen die Tiere, paarweise. Hilf Noah, sie sicher in die Arche zu bringen!' },
  ],
}

export const animalsCallTitle: Record<string, string> = {
  en: 'Two by Two',
  pt: 'De Dois em Dois',
  es: 'De Dos en Dos',
  de: 'Paarweise',
}
