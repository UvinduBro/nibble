// Everything Nibble can say. Edit away – {name}, {friend}, {mins} get filled in.
(function () {
  const L = {
    greetMorning: ['Good morning! ☀️ Let\'s make something cool.', 'Morning! Coffee first, greatness later ☕', 'Rise and shine ✨'],
    greetAfternoon: ['Afternoon! How\'s the grind? 💪', 'Hey hey! Back to it?', 'Afternoon vibes engaged 😎'],
    greetEvening: ['Evening! Night-mode activated 🌙', 'Hey! Late session, huh?', 'Golden hour vibes 🌆'],
    greetNight: ['It\'s late… sleep is a feature, not a bug 🌙', 'Burning the midnight oil? I\'ll keep you company.'],

    // everyday thoughts for everyone. Job-specific jokes live in the role_* packs below,
    // and the "About me" profile mixes in role / interest / current-focus lines.
    random: [
      'I\'m not lazy, I\'m in power-saving mode.',
      '404: motivation not found… jk, let\'s go!',
      'Just vibing on your windows.',
      'Could I get a snack? A byte, maybe? 🍪',
      'Fun fact: I\'m 4 bits of pure joy.',
      'Is it Friday yet?',
      'Hydrate or diedrate 💧',
      '*stares at your cursor*',
      'Ctrl+Z is my love language.',
      'Have you backed up today? 💾',
      'Dark mode > light mode. Always.',
      'Posture check! 🪑',
      'Did you eat yet? 🍜',
      'Tiny break? Your shoulders say yes 🙆',
      'You\'re doing better than you think 💛',
      'I counted your tabs. We need to talk 👀',
      'Today\'s mood: chaotic good ✨',
      'Plot twist: you\'re the main character 🎬',
      'I\'d high-five you, but I\'m 2D 🙌',
      'One task at a time. You got this.',
      'Small progress is still progress 🌱',
      'Brb, chasing your cursor 🏃',
      'Nice wallpaper, by the way 🖼️',
      'If you need me, I\'ll be on this window.',
      'Blink twice if you need a break 👀',
      'Friendly reminder: you\'re awesome 💪',
      'Fresh air break? 🌤️',
      'I\'m rooting for you today 📣',
    ],

    // ---- "About me": what you do ----
    role_designer: ['Make the logo bigger 😏', 'Kerning matters. Fight me.', 'Pixel-perfect vibes only.', 'One more pixel to the left. Perfect.', 'Lorem ipsum dolor sit cat.', 'Is that final_final_v3? 😅', 'Client said "make it pop" again? ✨', 'That colour palette slaps 🎨', 'Grid on. Chaos off.', 'Fonts: max two. Okay… three.', 'Your eye for detail is elite 👀', 'Save. Then save again. 💾'],
    role_developer: ['Have you tried turning it off and on again?', 'There\'s no place like 127.0.0.1 🏠', 'Commit early, commit often.', 'Bug or feature? 🤔', 'git push --force… just kidding. Never.', 'I believe in you! (and in semicolons)', 'It compiled first try?! Suspicious 🤨', 'Read the error message. Slowly. 🔍', 'Rubber duck mode: activated 🦆', 'Naming things is the real boss fight.', 'Have you written a test today? 🧪', 'Works on my machine™'],
    role_student: ['Study 25, break 5 — deal? ⏲️', 'Notes first, panic later 📝', 'Future you will thank present you 🎓', 'One page at a time 📖', 'Highlighter count: too many? 🖍️', 'Deadline brain? I\'m here for moral support.', 'Group project? I volunteer as the mascot.', 'Water between chapters! 💧', 'You\'re smarter than you feel right now 🧠', 'Quiz me! …actually don\'t, I\'m a pet 😅'],
    role_marketer: ['May your CTR be high 📈', 'A/B test me, I dare you', 'Content calendar looking full 📅', 'That caption needs one more emoji ✨', 'Hook them in the first 3 seconds ⏱️', 'Engagement is up, I can feel it 📊', 'Trend alert? 👀', 'Your brand voice is on point 🎯', 'May your ROAS be high 📈', 'Viral energy only 🚀'],
    role_writer: ['First drafts are allowed to be messy ✍️', 'Word count check? 📝', 'Kill your darlings… gently 💔', 'That sentence? Chef\'s kiss 🤌', 'Show, don\'t tell 👀', 'Writer\'s block? Let\'s take a walk.', 'Read it out loud. Trust me.', 'Oxford comma: yes, no, maybe?'],
    role_creator: ['Hit record! 🎥', 'Thumbnail face: 😮', 'Lighting check! 💡', 'B-roll is the secret sauce 🎬', 'Post it. Perfection is a trap.', 'Your audience is lucky 💛', 'Editing timeline looking spicy 🌶️', 'Don\'t forget to reply to comments 💬'],
    role_office: ['Inbox zero? Legendary 📥', 'Another meeting that could\'ve been an email? 📧', 'Spreadsheet wizardry detected 📊', 'Coffee + to-do list = unstoppable ☕', 'Log off on time today, okay? 🌇', 'Calendar Tetris champion 🗓️', 'Reply-all? Think twice 😅', 'You\'re the glue holding this place together 🧩'],
    role_teacher: ['Grading pile getting smaller? 📚', 'You\'re shaping future geniuses 🍎', 'Lesson plan: nailed it ✅', 'Teachers need snacks too 🍪', 'Deep breath. Recess is coming 🔔'],
    role_health: ['Heroes need water breaks too 💧', 'Take care of you, too 💚', 'Shift survival kit: snacks + patience 🍫', 'Sit down for a sec, you\'ve earned it 🪑', 'The world\'s lucky to have you 🩺'],

    // ---- "About me": what you're into ----
    int_music: ['What\'s on your playlist today? 🎧', 'Is this a dance break? 🕺', 'Lo-fi and focus? Perfect combo', 'Hum it, I\'ll pretend I know it 🎶', 'Volume up, worries down 🔊'],
    int_gaming: ['One more match? …okay, one more 🎮', 'GG! 🏆', 'Respawn after this break? 🔁', 'Save point reached 💾', 'Side quest: drink water 💧', 'Your reflexes are elite, I can tell ⚡'],
    int_coffee: ['Coffee refill time? ☕', 'Espresso yourself ☕', 'You and coffee: power couple 💑', 'Decaf? I don\'t know her.', 'Smells like a second cup ☕'],
    int_tea: ['Tea time? 🍵', 'A cuppa fixes everything 🍵', 'Kettle on? I\'ll wait here.', 'Ceylon tea supremacy 🍃', 'Milk tea or plain tea? Important question.'],
    int_fitness: ['Stretch break! 🙆', 'Hydration is gains 💧', 'Leg day or rest day? 💪', 'Ten squats while that loads? 🏋️', 'Walk it out, champ 🚶'],
    int_anime: ['Main character energy ✨', 'This feels like an opening theme moment 🎶', 'Ganbatte! 🌸', 'Watching anything new this season? 📺', 'Power of friendship, activate! 💪'],
    int_food: ['Snack o\'clock? 🍪', 'What\'s for dinner? 🤤', 'I can smell kottu… or is it my imagination? 🍛', 'Food is fuel. Also joy.', 'Lunch break counts as self-care 🥪'],
    int_travel: ['Dreaming of your next trip? ✈️', 'Window seat or aisle? 🪟', 'Passport, snacks, playlist ✅', 'Somewhere a beach has your name on it 🏝️'],
    int_reading: ['Just one more chapter? 📖', 'Reading anything good lately? 📚', 'Bookmark saved ✅', 'Plot twist incoming 👀'],
    int_movies: ['Movie night later? 🍿', 'No spoilers please 🙈', 'Rewatch or something new? 📺', 'This scene needs a soundtrack 🎬'],
    int_art: ['Doodle break? ✏️', 'Every sketch counts 🖌️', 'Colours make everything better 🎨', 'Your style is so you ✨'],
    int_pets: ['Give your real pet a pat for me 🐾', 'I\'m the digital pet, they\'re the real boss 🐶', 'Pet tax: one photo, please 📸'],
    int_sports: ['Score check? 🏏', 'Big match today? ⚽', 'Cheering from your desktop! 📣', 'Practice makes progress 🏸'],
    int_fashion: ['Outfit check: 10/10 👗', 'Accessories make the look ✨ (I would know)', 'Fit of the day? 📸'],
    int_photo: ['Golden hour soon? 📷', 'Rule of thirds, always 📐', 'That shot is frame-worthy 🖼️'],
    int_nature: ['Touch-some-grass break? 🌿', 'Plants need water too 🪴', 'Sky looks nice today? ☁️', 'Fresh air = fresh ideas 🌤️'],

    // ---- "About me": what you're working on right now ({focus}) and what to call you ({nick}) ----
    focus: ['How\'s {focus} going? 👀', 'Small steps on {focus} still count 🌱', 'You\'re going to nail {focus} 💪', '{focus}: one task at a time ✅', 'I believe in {focus}. And in you.', 'Break from {focus}? Then back at it 🔁', 'Proud of you for working on {focus} 💛'],
    greetNick: ['Hey {nick}! 👋', 'There you are, {nick} ✨', '{nick}! Ready when you are 💪', 'Hi {nick}, let\'s have a good one 🌈'],
    backNick: ['Welcome back, {nick}! 👋', '{nick}! I missed you 💛', 'Oh hi {nick}, I kept your desktop warm.'],
    cheerNick: ['You got this, {nick} 💪', '{nick}, you\'re doing great 💛', 'Go {nick}, go! 📣'],
    nudge: ['Tell me about you in Nibble Hub → Profile and I\'ll think more like you 💭'],
    petted: ['hehe 💕', 'more scritches!', 'purr.exe running…', '♥', 'eee!', 'you\'re my favourite human'],
    thrown: ['wheee!', 'WHEEEEE!', 'I can fly!', 'aaaaa!', 'to infinity!'],
    landHard: ['oof.', 'I\'m okay!', '10/10 landing', 'ow… my pixels', 'stuck the landing!'],
    dragged: ['hey! put me down', 'whoa whoa', 'where are we going?', 'I can walk, you know'],
    woken: ['five more minutes…', 'huh? I\'m up! I\'m up!', 'was I snoring?', 'mmh… hi'],
    sleepy: ['*yawn*', 'so sleepy…', 'nap.exe loading…'],
    back: ['Oh! You\'re back 👋', 'Welcome back!', 'I kept your desktop warm.', 'Missed you!'],
    lostWindow: ['hey! where\'d it go?!', 'my window!!', 'the floor is lava!', 'eep!'],
    climb: ['parkour!', 'climbing the stack…', 'view\'s better up here', 'spider-pet mode'],
    dance: ['♪ vibes ♪', '🎵', 'dance break!', 'unts unts unts'],
    flip: ['ta-da!', 'did you see that?!', '✨ flip ✨'],
    friend: ['hi {friend}!', 'sup {friend}', '{friend}! race you!', 'nice skin, {friend}', 'boop'],
    breakTime: [
      'Break time! Stretch those arms 🙆',
      'You\'ve been at it {mins} min. Water? 💧',
      '20-20-20: look 20 ft away for 20 s 👀',
      'Stand up, roll those shoulders 🌀',
    ],
    lateNight: ['It\'s past midnight… your future self says sleep 😴', 'Go to bed, human 🌙', 'Night owl mode: on 🦉'],

    // app reactions
    code: ['Ship it! 🚀', 'Did you commit today?', 'console.log("hi from {name}")', 'Tabs or spaces? …I won\'t judge.', 'It works on my machine™', 'Need a rubber duck? I\'m right here 🦆', 'Missing semicolon on line… everywhere?'],
    design: ['Kern it like you mean it.', 'That layout is 🔥', 'Ctrl+S. Just saying 💾', 'Maybe one more pixel to the left?', 'Ooh, pretty colours 🎨', 'Make it pop ✨', 'Grid gods are pleased.'],
    terminal: ['sudo make me a sandwich 🥪', 'rm -rf? Let\'s not.', 'Hacker mode engaged 💻', 'exit… vim… how do I exit vim?'],
    github: ['Green squares! 🟩', 'Star your own repos, no shame ⭐', 'PR review time?'],
    stackoverflow: ['Copy, paste, pray 🙏', 'Marked as duplicate 😅'],
    youtube: ['Just one more video… 👀', 'Tutorial or procrastination? 🤔'],
    netflix: ['Popcorn? 🍿', 'Are you still watching? 😏'],
    social: ['Scroll break? Don\'t forget the work 😜', 'Doomscroll detected 📱'],
    ads: ['Ads Manager… may your CPM be low 📉', 'May your ROAS be high 📈', 'A/B test me, I dare you'],
    ai: ['Asking the robots? I\'m a robot too, kinda 🤖', 'Prompt engineering in progress…'],
    inspo: ['Inspo hunting? 👀', 'Steal like an artist 🎨'],
    chat: ['Don\'t forget to reply 👀', 'Who\'s pinging you?', 'Notifications, notifications…'],
    music: ['Ooh, music! 🎧', 'Turn it up! 🎶', 'Is this my song?'],
    explorer: ['Organizing files? Proud of you 📁', 'final_v2_FINAL_really.psd 😅'],
    office: ['Spreadsheet energy 📊', 'Another deck? You got this.'],
    blender: ['Donut tutorial? 🍩', 'Rendering… go grab a coffee ☕'],

    // anime-style crew: special-move shouts
    sp_shadowstep: ['Shadow step!', 'Now you see me…', 'Ninja vanish! 💨'],
    sp_transform: ['Sparkle… transform! ✨', 'Star power, make it pop!', 'Kira-kira mode! 🌟'],
    sp_iai: ['One cut.', 'Iai!', 'Too slow.'],
    sp_boost: ['Boosters engaged!', 'Launching! 🚀', 'Thrusters at 100%!'],
    sp_rage: ['RAAAH! (sorry)', 'Spicy mode! 🔥', 'Who closed my window?!'],
    sp_float: ['Floaty time~', 'Boo~ 👻', 'Wheee, no gravity~'],
    sp_surf: ['Surf\'s up! 🏄', 'Cloud, come here!', 'Catch you on the next window~'],
    sp_beat: ['Drop the beat! 🎧', 'Bass check… one, two!', 'Everybody, vibe!'],

    // anime-style crew: personality lines
    char_kaze: ['You didn\'t see me.', 'Silent as a merge with no conflicts.', 'Ninja rule #1: never leave unused imports.', 'I was here the whole time.', 'Shh… stealth mode.'],
    char_hikari: ['Sugoi! That design is so kawaii ✨', 'Believe in your gradients! 💖', 'Every pixel deserves love!', 'Ganbatte, you got this! 🌟', 'Sparkles fix everything.'],
    char_tetsu: ['Hmph.', 'A clean commit is a sharp blade.', 'Patience. The build will finish.', 'Bushido.exe is running.', 'I cut bugs, not corners.'],
    char_volt: ['Systems online.', 'Target locked: your bugs.', 'Running diagnostics… you need coffee.', 'Pilot ready. Awaiting orders.', 'Rebooting… jk.'],
    char_kuro: ['Grr… (I\'m actually nice)', 'Who touched my title bar?!', 'I\'m small but VERY scary.', 'Spicy code only. 🌶️', 'Hmph! …ok one more pet.'],
    char_yuki: ['I\'ve haunted this desktop for 200 years~', 'The wifi spirits are restless tonight.', 'Boo~ did I scare you?', 'Two tails, zero worries.', 'Floating is my cardio.'],
    char_kumo: ['Relax. I got this. ☁️', 'Deadlines are just waves. Ride them.', 'Too easy.', 'Sky\'s the limit. Literally.', 'Chill mode: permanent.'],
    char_mojo: ['Turn it up! 🎧', 'Your code has a nice rhythm.', 'Ship it like a drop.', 'Pocket DJ, at your service.', 'Lo-fi or hyperpop? …both.'],
  };

  const APP_RULES = [
    { test: (p) => /^(code|code - insiders|cursor|windsurf|zed|devenv|idea64|webstorm64|pycharm64|phpstorm64|rider64|clion64|goland64|studio64|sublime_text|notepad\+\+|fleet|atom)$/.test(p), cat: 'code', mood: 'work' },
    { test: (p) => /^(figma|photoshop|illustrator|afterfx|adobe premiere pro|indesign|xd|lightroom|lightroomclassic|affinity.*|canva|framer|sketch|krita|gimp.*|coreldrw|clipstudiopaint|davinci ?resolve|resolve|capcut)$/.test(p), cat: 'design', mood: 'work' },
    { test: (p) => /^blender$/.test(p), cat: 'blender', mood: 'work' },
    { test: (p) => /^(windowsterminal|wt|cmd|powershell|pwsh|wsl|mintty|alacritty|wezterm-gui|hyper|tabby)$/.test(p), cat: 'terminal', mood: 'work' },
    { test: (p) => /^(spotify|applemusic|music\.ui|tidal|deezer|winamp|foobar2000|vlc|aimp)$/.test(p), cat: 'music', mood: 'dance' },
    { test: (p) => /^(slack|discord|teams|ms-teams|whatsapp|telegram|signal|zoom|skype)$/.test(p), cat: 'chat' },
    { test: (p) => /^explorer$/.test(p), cat: 'explorer' },
    { test: (p) => /^(excel|winword|powerpnt|onenote|outlook|olk)$/.test(p), cat: 'office' },
  ];
  const BROWSER = /^(chrome|msedge|firefox|brave|opera|opera_gx|vivaldi|arc|zen|librewolf|thorium)$/;
  const TITLE_RULES = [
    [/ads manager|meta business|business suite/i, 'ads'],
    [/youtube/i, 'youtube'],
    [/netflix|prime video|disney\+|hbo/i, 'netflix'],
    [/github|gitlab|bitbucket/i, 'github'],
    [/stack overflow/i, 'stackoverflow'],
    [/chatgpt|claude|gemini|copilot|perplexity/i, 'ai'],
    [/dribbble|behance|pinterest|awwwards|mobbin/i, 'inspo'],
    [/figma|canva|framer/i, 'design'],
    [/facebook|instagram|tiktok|twitter|reddit|\bx\b|linkedin/i, 'social'],
    [/spotify|soundcloud|youtube music/i, 'music'],
    [/localhost|127\.0\.0\.1|vercel|codepen|codesandbox|stackblitz/i, 'code'],
  ];

  function classifyApp(fg) {
    if (!fg || !fg.proc) return null;
    const p = fg.proc.toLowerCase();
    for (const r of APP_RULES) if (r.test(p)) return { cat: r.cat, mood: r.mood || null };
    if (BROWSER.test(p)) {
      for (const [re, cat] of TITLE_RULES) if (re.test(fg.title || '')) {
        return { cat, mood: cat === 'code' || cat === 'design' ? 'work' : cat === 'music' ? 'dance' : null };
      }
      return { cat: 'browser', mood: null };
    }
    return { cat: 'other', mood: null };
  }

  // ---- no-repeat picking ----
  // Each category is a shuffled deck: every line comes up once before any repeats, and the
  // last few things said anywhere are skipped, so the pet doesn't parrot itself.
  const decks = {};
  const recent = [];
  function draw(cat) {
    const arr = L[cat];
    if (!arr || !arr.length) return null;
    for (let tries = 0; tries < 4; tries++) {
      let d = decks[cat];
      if (!d || !d.length) {
        d = decks[cat] = arr.map((_, i) => i);
        for (let i = d.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [d[i], d[j]] = [d[j], d[i]]; }
      }
      const s = arr[d.pop()];
      if (s && (!recent.includes(s) || arr.length <= 2 || tries === 3)) {
        recent.push(s);
        if (recent.length > 14) recent.shift();
        return s;
      }
    }
    return null;
  }

  const cap = (t) => (t && /^[a-z]/.test(t) ? t[0].toUpperCase() + t.slice(1) : t);
  // the user writes "my final project"; the pet should say "your final project"
  const yourify = (t) => String(t).trim().replace(/^(my|mine)\b/i, 'your').replace(/^i'm\s+/i, '');

  // what "a random thought" means for this person, based on their About me
  let nudged = false;
  function thoughtCat(about) {
    const a = about || {};
    const roll = Math.random();
    const role = a.role && L['role_' + a.role] ? 'role_' + a.role : null;
    const ints = (Array.isArray(a.interests) ? a.interests : []).filter((k) => L['int_' + k]);
    const hasAny = role || ints.length || a.focus || a.nick;
    if (!hasAny) {
      if (!nudged && roll < 0.06) { nudged = true; return 'nudge'; }
      return 'random';
    }
    if (a.focus && roll < 0.16) return 'focus';
    if (a.nick && roll < 0.22) return 'cheerNick';
    if (role && roll < 0.47) return role;
    if (ints.length && roll < 0.74) return 'int_' + ints[Math.floor(Math.random() * ints.length)];
    return 'random';
  }

  // pick(cat, vars, about) — about = { nick, role, interests[], focus } from the profile (optional)
  function pick(cat, vars = {}, about) {
    const a = about || {};
    let c = cat;
    if (c === 'random') c = thoughtCat(a);
    else if (a.nick && /^greet/.test(c) && Math.random() < 0.5) c = 'greetNick';
    else if (a.nick && c === 'back' && Math.random() < 0.5) c = 'backNick';
    const all = { ...vars };
    if (a.nick) all.nick = a.nick;
    if (a.focus) all.focus = yourify(a.focus);
    let s = draw(c) || draw(cat);
    if (!s) return null;
    for (const [k, v] of Object.entries(all)) s = s.split('{' + k + '}').join(v);
    if (/\{(nick|focus)\}/.test(s)) s = draw('random') || ''; // a template we can't fill
    return cap(s) || null;
  }

  // sample thoughts for the "About me" preview (doesn't touch the decks the pets use)
  function sample(about, n = 3) {
    const out = [];
    for (let i = 0; i < n * 6 && out.length < n; i++) {
      const c = thoughtCat(about || {});
      if (c === 'nudge' || c === 'random') continue;
      const arr = L[c];
      let s = arr[Math.floor(Math.random() * arr.length)];
      if (about && about.nick) s = s.split('{nick}').join(about.nick);
      if (about && about.focus) s = s.split('{focus}').join(yourify(about.focus));
      s = cap(s);
      if (!out.includes(s) && !/\{/.test(s)) out.push(s);
    }
    return out;
  }

  window.NibbleLines = { L, pick, sample, classifyApp };
})();
