// Chapter 5 finale text: the flood, the dove and the rainbow (Genesis 7–9).
// Scripture uses the same translations as strings.ts:
//   EN Berean Standard Bible (BSB), as shown on shofar-app.com
//   PT João Ferreira de Almeida, Revista e Corrigida, Lisbon 1911 (public domain; spelling modernised)
//   ES Reina-Valera 1909 (accents on "á", "é", "fué" modernised)
//   DE Elberfelder 1871
// A "b" after a verse number (7:11b, 7:23b) marks a verse trimmed to its second half.
import type { Lang, Line } from './strings'

export type FloodStrings = {
  title: string
  /** 14 scripture lines; the dove moment happens after line DOVE_AFTER. */
  lines: Line[]
  doveTitle: string
  doveTap: string
  doveTapKeys: string
  doveSteer: string
  doveSteerKeys: string
  doveFound: string
  stars: string
  theEnd: string
  thanks: string
  credits: { h: string; v: string }[]
}

/** Index of the line after which the interactive dove flight plays (Genesis 8:8). */
export const DOVE_AFTER = 7

const TECH = 'React · three.js · React Three Fiber · drei · zustand · Vite'
const FONTS = 'Cormorant Garamond · DM Sans · Fredoka (SIL Open Font License)'
const TRANSLATIONS = 'Berean Standard Bible (BSB) · João Ferreira de Almeida (1911) · Reina-Valera 1909 · Elberfelder 1871'

const en: FloodStrings = {
  title: 'The Flood and the Promise',
  lines: [
    { speaker: 'narrator', ref: 'Genesis 7:16', text: 'And they entered, the male and female of every living thing, as God had commanded Noah. Then the LORD shut him in.' },
    { speaker: 'narrator', ref: 'Genesis 7:11b–12', text: 'All the fountains of the great deep burst forth, and the floodgates of the heavens were opened. And the rain fell upon the earth for forty days and forty nights.' },
    { speaker: 'narrator', ref: 'Genesis 7:17', text: 'For forty days the flood kept coming on the earth, and the waters rose and lifted the ark high above the earth.' },
    { speaker: 'narrator', ref: 'Genesis 7:18–19', text: 'So the waters continued to surge and rise greatly on the earth, and the ark floated on the surface of the waters. Finally, the waters completely prevailed upon the earth, so that all the high mountains under all the heavens were covered.' },
    { speaker: 'narrator', ref: 'Genesis 7:23b', text: 'Only Noah and those with him in the ark remained.' },
    { speaker: 'narrator', ref: 'Genesis 8:1', text: 'But God remembered Noah and all the animals and livestock that were with him in the ark. And God sent a wind over the earth, and the waters began to subside.' },
    { speaker: 'narrator', ref: 'Genesis 8:4', text: 'On the seventeenth day of the seventh month, the ark came to rest on the mountains of Ararat.' },
    { speaker: 'narrator', ref: 'Genesis 8:8', text: 'Then Noah sent out a dove to see if the waters had receded from the surface of the ground.' },
    { speaker: 'narrator', ref: 'Genesis 8:11', text: 'And behold, the dove returned to him in the evening with a freshly plucked olive leaf in her beak. So Noah knew that the waters had receded from the earth.' },
    { speaker: 'god', ref: 'Genesis 8:16', text: 'Come out of the ark, you and your wife, along with your sons and their wives.' },
    { speaker: 'narrator', ref: 'Genesis 8:18–19', text: 'So Noah came out, along with his sons and his wife and his sons’ wives. Every living creature, every creeping thing, and every bird—everything that moves upon the earth—came out of the ark, kind by kind.' },
    { speaker: 'narrator', ref: 'Genesis 8:20', text: 'Then Noah built an altar to the LORD. And taking from every kind of clean animal and clean bird, he offered burnt offerings on the altar.' },
    { speaker: 'god', ref: 'Genesis 9:13', text: 'I have set My rainbow in the clouds, and it will be a sign of the covenant between Me and the earth.' },
    { speaker: 'god', ref: 'Genesis 9:15', text: 'I will remember My covenant between Me and you and every living creature of every kind. Never again will the waters become a flood to destroy all life.' },
  ],
  doveTitle: 'Send out the dove!',
  doveTap: 'Tap to let the dove fly',
  doveTapKeys: 'Click or press Space to let the dove fly',
  doveSteer: 'Drag your finger to guide the dove to the olive tree',
  doveSteerKeys: 'Move the mouse or use the arrow keys to guide the dove',
  doveFound: 'An olive leaf!',
  stars: 'Stars',
  theEnd: 'The End',
  thanks: 'Thank you for playing!',
  credits: [
    { h: 'Story', v: 'Genesis 6–9' },
    { h: 'Scripture', v: TRANSLATIONS },
    { h: 'Fonts', v: FONTS },
    { h: 'Painted art', v: 'FLUX.1 [schnell] via fal.ai' },
    { h: 'Voices and music', v: 'AI generated with fal.ai' },
    { h: 'Sound effects', v: 'Synthesized live with Web Audio' },
    { h: 'Made with', v: TECH },
  ],
}

const pt: FloodStrings = {
  title: 'O Dilúvio e a Promessa',
  lines: [
    { speaker: 'narrator', ref: 'Gênesis 7:16', text: 'E os que entraram, macho e fêmea de toda a carne entraram, como Deus lhe tinha ordenado: e o Senhor o fechou por fora.' },
    { speaker: 'narrator', ref: 'Gênesis 7:11b–12', text: 'Naquele mesmo dia se romperam todas as fontes do grande abismo, e as janelas dos céus se abriram, e houve chuva sobre a terra quarenta dias e quarenta noites.' },
    { speaker: 'narrator', ref: 'Gênesis 7:17', text: 'E esteve o dilúvio quarenta dias sobre a terra, e cresceram as águas, e levantaram a arca, e ela se elevou sobre a terra.' },
    { speaker: 'narrator', ref: 'Gênesis 7:18–19', text: 'E prevaleceram as águas, e cresceram grandemente sobre a terra; e a arca andava sobre as águas. E as águas prevaleceram excessivamente sobre a terra; e todos os altos montes, que havia debaixo de todo o céu, foram cobertos.' },
    { speaker: 'narrator', ref: 'Gênesis 7:23b', text: 'E ficou somente Noé, e os que com ele estavam na arca.' },
    { speaker: 'narrator', ref: 'Gênesis 8:1', text: 'E lembrou-se Deus de Noé, e de toda a besta, e de todo o animal, e de toda a rês que com ele estava na arca: e Deus fez passar um vento sobre a terra, e aquietaram-se as águas.' },
    { speaker: 'narrator', ref: 'Gênesis 8:4', text: 'E a arca repousou, no sétimo mês, no dia dezessete do mês, sobre os montes de Ararat.' },
    { speaker: 'narrator', ref: 'Gênesis 8:8', text: 'Depois soltou uma pomba, a ver se as águas tinham minguado de sobre a face da terra.' },
    { speaker: 'narrator', ref: 'Gênesis 8:11', text: 'E a pomba voltou a ele sobre a tarde; e eis, arrancada, uma folha de oliveira no seu bico: e conheceu Noé que as águas tinham minguado sobre a terra.' },
    { speaker: 'god', ref: 'Gênesis 8:16', text: 'Sai da arca, tu, e tua mulher, e teus filhos, e as mulheres de teus filhos contigo.' },
    { speaker: 'narrator', ref: 'Gênesis 8:18–19', text: 'Então saiu Noé, e seus filhos, e sua mulher, e as mulheres de seus filhos com ele, todo o animal, todo o réptil, e toda a ave, e tudo o que se move sobre a terra, conforme as suas famílias, saiu para fora da arca.' },
    { speaker: 'narrator', ref: 'Gênesis 8:20', text: 'E edificou Noé um altar ao Senhor; e tomou de todo o animal limpo, e de toda a ave limpa, e ofereceu holocaustos sobre o altar.' },
    { speaker: 'god', ref: 'Gênesis 9:13', text: 'O meu arco tenho posto na nuvem: este será por sinal do concerto entre mim e a terra.' },
    { speaker: 'god', ref: 'Gênesis 9:15', text: 'Então me lembrarei do meu concerto, que está entre mim e vós, e entre toda a alma vivente de toda a carne: e as águas não se tornarão mais em dilúvio, para destruir toda a carne.' },
  ],
  doveTitle: 'Solte a pomba!',
  doveTap: 'Toque para a pomba voar',
  doveTapKeys: 'Clique ou aperte Espaço para a pomba voar',
  doveSteer: 'Arraste o dedo para guiar a pomba até a oliveira',
  doveSteerKeys: 'Mova o mouse ou use as setas para guiar a pomba',
  doveFound: 'Uma folha de oliveira!',
  stars: 'Estrelas',
  theEnd: 'Fim',
  thanks: 'Obrigado por jogar!',
  credits: [
    { h: 'História', v: 'Gênesis 6–9' },
    { h: 'Escrituras', v: TRANSLATIONS },
    { h: 'Fontes', v: FONTS },
    { h: 'Ilustrações', v: 'FLUX.1 [schnell] via fal.ai' },
    { h: 'Vozes e música', v: 'Geradas por IA com fal.ai' },
    { h: 'Efeitos sonoros', v: 'Sintetizados ao vivo com Web Audio' },
    { h: 'Feito com', v: TECH },
  ],
}

const es: FloodStrings = {
  title: 'El Diluvio y la Promesa',
  lines: [
    { speaker: 'narrator', ref: 'Génesis 7:16', text: 'Y los que vinieron, macho y hembra de toda carne vinieron, como le había mandado Dios: y Jehová le cerró la puerta.' },
    { speaker: 'narrator', ref: 'Génesis 7:11b–12', text: 'Aquel día fueron rotas todas las fuentes del grande abismo, y las cataratas de los cielos fueron abiertas; y hubo lluvia sobre la tierra cuarenta días y cuarenta noches.' },
    { speaker: 'narrator', ref: 'Génesis 7:17', text: 'Y fue el diluvio cuarenta días sobre la tierra; y las aguas crecieron, y alzaron el arca, y se elevó sobre la tierra.' },
    { speaker: 'narrator', ref: 'Génesis 7:18–19', text: 'Y prevalecieron las aguas, y crecieron en gran manera sobre la tierra; y andaba el arca sobre la faz de las aguas. Y las aguas prevalecieron mucho en extremo sobre la tierra; y todos los montes altos que había debajo de todos los cielos, fueron cubiertos.' },
    { speaker: 'narrator', ref: 'Génesis 7:23b', text: 'Y quedó solamente Noé, y lo que con él estaba en el arca.' },
    { speaker: 'narrator', ref: 'Génesis 8:1', text: 'Y acordóse Dios de Noé, y de todos los animales, y de todas las bestias que estaban con él en el arca; e hizo pasar Dios un viento sobre la tierra, y disminuyeron las aguas.' },
    { speaker: 'narrator', ref: 'Génesis 8:4', text: 'Y reposó el arca en el mes séptimo, a diecisiete días del mes, sobre los montes de Armenia.' },
    { speaker: 'narrator', ref: 'Génesis 8:8', text: 'Envió también de sí a la paloma, para ver si las aguas se habían retirado de sobre la faz de la tierra.' },
    { speaker: 'narrator', ref: 'Génesis 8:11', text: 'Y la paloma volvió a él a la hora de la tarde; y he aquí que traía una hoja de oliva tomada en su pico: y entendió Noé que las aguas se habían retirado de sobre la tierra.' },
    { speaker: 'god', ref: 'Génesis 8:16', text: 'Sal del arca tú, y tu mujer, y tus hijos, y las mujeres de tus hijos contigo.' },
    { speaker: 'narrator', ref: 'Génesis 8:18–19', text: 'Entonces salió Noé, y sus hijos, y su mujer, y las mujeres de sus hijos con él. Todos los animales, y todo reptil y toda ave, todo lo que se mueve sobre la tierra según sus especies, salieron del arca.' },
    { speaker: 'narrator', ref: 'Génesis 8:20', text: 'Y edificó Noé un altar a Jehová, y tomó de todo animal limpio y de toda ave limpia, y ofreció holocausto en el altar.' },
    { speaker: 'god', ref: 'Génesis 9:13', text: 'Mi arco pondré en las nubes, el cual será por señal de convenio entre mí y la tierra.' },
    { speaker: 'god', ref: 'Génesis 9:15', text: 'Y acordarme he del pacto mío, que hay entre mí y vosotros y toda alma viviente de toda carne; y no serán más las aguas por diluvio para destruir toda carne.' },
  ],
  doveTitle: '¡Suelta la paloma!',
  doveTap: 'Toca para que la paloma vuele',
  doveTapKeys: 'Haz clic o pulsa Espacio para que la paloma vuele',
  doveSteer: 'Arrastra el dedo para guiar a la paloma hasta el olivo',
  doveSteerKeys: 'Mueve el ratón o usa las flechas para guiar a la paloma',
  doveFound: '¡Una hoja de olivo!',
  stars: 'Estrellas',
  theEnd: 'Fin',
  thanks: '¡Gracias por jugar!',
  credits: [
    { h: 'Historia', v: 'Génesis 6–9' },
    { h: 'Escrituras', v: TRANSLATIONS },
    { h: 'Tipografías', v: FONTS },
    { h: 'Ilustraciones', v: 'FLUX.1 [schnell] vía fal.ai' },
    { h: 'Voces y música', v: 'Generadas con IA en fal.ai' },
    { h: 'Efectos de sonido', v: 'Sintetizados en vivo con Web Audio' },
    { h: 'Hecho con', v: TECH },
  ],
}

const de: FloodStrings = {
  title: 'Die Flut und das Versprechen',
  lines: [
    { speaker: 'narrator', ref: '1. Mose 7,16', text: 'Und die hineingingen, waren ein Männliches und ein Weibliches von allem Fleische, wie Gott ihm geboten hatte. Und Jehova schloß hinter ihm zu.' },
    { speaker: 'narrator', ref: '1. Mose 7,11b–12', text: 'An diesem Tage brachen auf alle Quellen der großen Tiefe, und die Fenster des Himmels taten sich auf. Und der Regen fiel auf die Erde vierzig Tage und vierzig Nächte.' },
    { speaker: 'narrator', ref: '1. Mose 7,17', text: 'Und die Flut kam vierzig Tage lang über die Erde. Und die Wasser mehrten sich und hoben die Arche empor; und sie erhob sich über die Erde.' },
    { speaker: 'narrator', ref: '1. Mose 7,18–19', text: 'Und die Wasser nahmen überhand und mehrten sich sehr auf der Erde; und die Arche fuhr auf der Fläche der Wasser. Und die Wasser nahmen gar sehr überhand auf der Erde, und es wurden bedeckt alle hohen Berge, die unter dem ganzen Himmel sind.' },
    { speaker: 'narrator', ref: '1. Mose 7,23b', text: 'Und nur Noah blieb übrig und was mit ihm in der Arche war.' },
    { speaker: 'narrator', ref: '1. Mose 8,1', text: 'Und Gott gedachte des Noah und alles Getieres und alles Viehes, das mit ihm in der Arche war; und Gott ließ einen Wind über die Erde fahren, und die Wasser sanken.' },
    { speaker: 'narrator', ref: '1. Mose 8,4', text: 'Und im siebten Monat, am siebzehnten Tage des Monats, ruhte die Arche auf dem Gebirge Ararat.' },
    { speaker: 'narrator', ref: '1. Mose 8,8', text: 'Und er ließ die Taube von sich aus, um zu sehen, ob die Wasser sich verlaufen hätten von der Fläche des Erdbodens.' },
    { speaker: 'narrator', ref: '1. Mose 8,11', text: 'Und die Taube kam zu ihm um die Abendzeit, und siehe, ein abgerissenes Olivenblatt war in ihrem Schnabel. Und Noah erkannte, daß die Wasser sich verlaufen hatten von der Erde.' },
    { speaker: 'god', ref: '1. Mose 8,16', text: 'Gehe aus der Arche, du und dein Weib und deine Söhne und die Weiber deiner Söhne mit dir.' },
    { speaker: 'narrator', ref: '1. Mose 8,18–19', text: 'Und Noah ging hinaus und seine Söhne und sein Weib und die Weiber seiner Söhne mit ihm. Alles Getier, alles Gewürm und alles Gevögel, alles was sich auf der Erde regt, nach ihren Arten, gingen aus der Arche.' },
    { speaker: 'narrator', ref: '1. Mose 8,20', text: 'Und Noah baute Jehova einen Altar; und er nahm von allem reinen Vieh und von allem reinen Gevögel und opferte Brandopfer auf dem Altar.' },
    { speaker: 'god', ref: '1. Mose 9,13', text: 'Meinen Bogen setze ich in die Wolken, und er soll das Zeichen des Bundes sein zwischen mir und der Erde.' },
    { speaker: 'god', ref: '1. Mose 9,15', text: 'Und ich werde meines Bundes gedenken, der zwischen mir und euch ist und jedem lebendigen Wesen, von allem Fleische; und nicht mehr sollen die Wasser zu einer Flut werden, alles Fleisch zu verderben.' },
  ],
  doveTitle: 'Lass die Taube fliegen!',
  doveTap: 'Tippe, damit die Taube fliegt',
  doveTapKeys: 'Klicke oder drücke die Leertaste, damit die Taube fliegt',
  doveSteer: 'Ziehe mit dem Finger, um die Taube zum Olivenbaum zu lenken',
  doveSteerKeys: 'Bewege die Maus oder nutze die Pfeiltasten, um die Taube zu lenken',
  doveFound: 'Ein Olivenblatt!',
  stars: 'Sterne',
  theEnd: 'Ende',
  thanks: 'Danke fürs Spielen!',
  credits: [
    { h: 'Geschichte', v: '1. Mose 6–9' },
    { h: 'Bibeltexte', v: TRANSLATIONS },
    { h: 'Schriften', v: FONTS },
    { h: 'Bilder', v: 'FLUX.1 [schnell] über fal.ai' },
    { h: 'Stimmen und Musik', v: 'Mit KI erzeugt über fal.ai' },
    { h: 'Soundeffekte', v: 'Live synthetisiert mit Web Audio' },
    { h: 'Gemacht mit', v: TECH },
  ],
}

export const FLOOD: Record<Lang, FloodStrings> = { en, pt, es, de }
