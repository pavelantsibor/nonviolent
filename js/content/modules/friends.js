/** Друзья */
export default {
  id: "friends",
  title: "С друзьями",
  goal: "Сказать другу, что вам больно от его шутки, без обвинения в злом умысле.",
  estimatedMinutes: 6,
  badge: {
    id: "badge-friends",
    label: "Дружеский Жираф",
    emoji: "🤝",
    giftTitle: "Мостик доверия",
    giftDescription: "Можно говорить о границах в шутках и оставаться в связи.",
  },
  steps: [
    {
      type: "theory",
      title: "Подарок в критике",
      body: `Друг пошутил про вас при компании. Вам не смешно.\n\nННО не требует «ломать дружбу» — можно честно назвать чувство и попросить другой формат шуток в будущем.`,
    },
    {
      type: "select",
      title: "Мягкий старт",
      prompt: "Как начать ближе к Жирафу?",
      options: [
        {
          id: "a",
          text: "Ты всегда такой злой.",
          quality: "poor",
          feedback: "«Всегда» и ярлык «злой».",
        },
        {
          id: "b",
          text: "Когда прозвучала шутка про меня, мне стало неловко и грустно.",
          quality: "best",
          feedback: "Факт + чувство без атаки личности.",
        },
        {
          id: "c",
          text: "Все смеялись, значит нормально.",
          quality: "ok",
          feedback: "Можно признать свою реакцию, даже если другим было смешно.",
        },
      ],
    },
    {
      type: "camera",
      title: "Факт",
      prompt: "Что из этого ближе к наблюдению?",
      options: [
        {
          id: "1",
          text: "Ты меня унизил(а).",
          correct: false,
          explain: "Интерпретация намерения.",
        },
        {
          id: "2",
          text: "Ты три раза повторил(а) шутку про мою работу.",
          correct: true,
          explain: "Счёт и содержание — то, что могла бы зафиксировать камера.",
        },
        {
          id: "3",
          text: "Ты вредный(ая).",
          correct: false,
          explain: "Оценка личности.",
        },
      ],
    },
    {
      type: "build",
      title: "Собери просьбу",
      instructions: "Подберите блоки к слотам.",
      slots: [
        { key: "observation", label: "Наблюдение" },
        { key: "feeling", label: "Чувство" },
        { key: "need", label: "Потребность" },
        { key: "request", label: "Просьба" },
      ],
      bank: [
        { id: "o1", slot: "observation", text: "Шутка прозвучала дважды за вечер." },
        { id: "o2", slot: "observation", text: "Ты плохой друг." },
        { id: "f1", slot: "feeling", text: "Мне стало неловко и обидно." },
        { id: "f2", slot: "feeling", text: "Ты должен страдать." },
        { id: "n1", slot: "need", text: "Мне важны уважение и доверие в нашем юморе." },
        { id: "n2", slot: "need", text: "Мне нужно победить спор." },
        { id: "r1", slot: "request", text: "Можешь в следующий раз без шуток про мою работу или спросить, границы ок?" },
        { id: "r2", slot: "request", text: "Запрети всем смеяться." },
      ],
      correct: {
        observation: "o1",
        feeling: "f1",
        need: "n1",
        request: "r1",
      },
    },
  ],
};
