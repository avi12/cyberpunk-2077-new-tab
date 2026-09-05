type Quote = {
  text: string;
  author: string;
};

/** The 72 quotes the original shipped, verbatim and in order. */
const QUOTES: [Quote, ...Quote[]] = [
  {
    text: "Wake up, samurai. We have a city to burn.",
    author: "Johnny Silverhand"
  },
  {
    text: "In 2077, what makes someone a criminal? Getting caught.",
    author: "Anonymous"
  },
  {
    text: "Never fade away.",
    author: "Johnny Silverhand"
  },
  {
    text: "Give yourself time. Ideas'll come. Life'll shake you, roll you, maybe embrace you. The music'll find you.",
    author: "Johnny Silverhand"
  },
  {
    text: "It's the code you live by that defines who you are.",
    author: "Johnny Silverhand"
  },
  {
    text: "Test of a person's true value? Death. Facing it, staring it down. You still got a chance to be somebody.",
    author: "Johnny Silverhand"
  },
  {
    text: "Here, for folks like us? Wrong city, wrong people.",
    author: "Johnny Silverhand"
  },
  {
    text: "Haven't forgotten a thing. Never will.",
    author: "Johnny Silverhand"
  },
  {
    text: "Goodbye, V, and never stop fighting.",
    author: "Johnny Silverhand"
  },
  {
    text: "Swap meat for chrome, live a BD fantasy, whatever, but at the end of it all, it's the code you live by that defines who you are.",
    author: "Johnny Silverhand"
  },
  {
    text: "Of all the heads I could have popped up in, hella glad it was yours.",
    author: "Johnny Silverhand"
  },
  {
    text: "I admit, I didn't expect that.",
    author: "Johnny Silverhand"
  },
  {
    text: "Oh, yeah, real mature! Not like I can cover my ears and go 'lalalalala' whenever you open your trap.",
    author: "Johnny Silverhand"
  },
  {
    text: "Get the payload on the elevator, arm it, let gravity do its thing. Explosion rocks the foundation, tower crumbles — chaos, screaming, roll credits.",
    author: "Johnny Silverhand"
  },
  {
    text: "Sabotage a corpo power station, jump a corpo transport, kidnap a corpo suit...",
    author: "Johnny Silverhand"
  },
  {
    text: "Guess I meant, I dunno... a happier ending... for everyone involved.",
    author: "V"
  },
  {
    text: "Just promise me one thing, asshole. You won't forget me.",
    author: "V"
  },
  {
    text: "I just want the world to know I was here. That I mattered.",
    author: "V"
  },
  {
    text: "Fear isn't a weakness. It is here to protect you.",
    author: "Skye"
  },
  {
    text: "Not a single thing in this world isn't in the process of becoming something else. Likewise you.",
    author: "Skye"
  },
  {
    text: "We shouldn't fear change itself, but only who we might change into.",
    author: "Misty"
  },
  {
    text: "Truth and good are values proven to cause division, whereas beauty is universal.",
    author: "Delamain"
  },
  {
    text: "The dead are so very, very loud. And yet, lying is not in their nature.",
    author: "Saburo Arasaka"
  },
  {
    text: "The heart should break but once.",
    author: "Saburo Arasaka"
  },
  {
    text: "You see, that's your problem. You think the world revolves around you. Arrogant.",
    author: "Yorinobu Arasaka"
  },
  {
    text: "Now, as that old Greek dawg says, life's a banquet — so don't go thirsty, but don't get drunk, either.",
    author: "Dexter 'Dex' DeShawn"
  },
  {
    text: "Careful, you can't know what I'd wish for.",
    author: "Panam Palmer"
  },
  {
    text: "The wider the smile, the bigger the lies.",
    author: "Goro Takemura"
  },
  {
    text: "Your body can be chrome, but the heart never changes. It wants what it wants.",
    author: "Lizzy Wizzy"
  },
  {
    text: "Johnny, remember the plan?",
    author: "Rogue Amendiares"
  },
  {
    text: "Say what now?",
    author: "Jackie Welles"
  },
  {
    text: "Ladies and gentlemen, Jackie Welles!",
    author: "Jackie Welles"
  },
  {
    text: "What is free often proves most costly.",
    author: "Anonymous"
  },
  {
    text: "Man dies the way he was born: soft, weak and helpless.",
    author: "Anonymous"
  },
  {
    text: "Bullets don't distinguish between tough and weak.",
    author: "Anonymous"
  },
  {
    text: "Only one with chaos within can give birth to a dancing star.",
    author: "Anonymous"
  },
  {
    text: "After a day as full as today, you deserve to kick back.",
    author: "V"
  },
  {
    text: "You think Jackie's looking down upon us... from up there?",
    author: "V"
  },
  {
    text: "But how do I keep up with everything that's changing?",
    author: "V"
  },
  {
    text: "What?",
    author: "Ozob"
  },
  {
    text: "The nail that protrudes from the wall gets hammered...",
    author: "Saburo Arasaka"
  },
  {
    text: "Some causes are worth pledging your life to, V. This ain't one of them.",
    author: "Johnny Silverhand"
  },
  {
    text: "Time to party like it's 2023.",
    author: "Johnny Silverhand"
  },
  {
    text: "If I gotta go down, I'd rather fall into my grave gun in hand and on fire.",
    author: "V"
  },
  {
    text: "Each and every time, I thought I'd found a home. And each and every time, I came away disappointed.",
    author: "Judy Alvarez"
  },
  {
    text: "Saw them transform Night City into a machine fueled by people's crushed spirits, broken dreams, and empty pockets.",
    author: "Johnny Silverhand"
  },
  {
    text: "Can't stop diggin' Night City.",
    author: "Radio/NPC"
  },
  {
    text: "Before it all goes dark... for one last second, I'll know I wasn't alone.",
    author: "Songbird"
  },
  {
    text: "To our dreams. For they alone keep us sane.",
    author: "V"
  },
  {
    text: "We all lap up the last of our fuel eventually. But that hardly means the journey wasn't a joy.",
    author: "Delamain"
  },
  {
    text: "Welcome to the world of the faces in the crowd, V.",
    author: "Misty Olszewski"
  },
  {
    text: "Sometimes it's just safer to shove the barrel of a Malorian between a choom's ribs, even if he is on your side. It's nothing personal.",
    author: "Solomon Reed"
  },
  {
    text: "Not askin' you to never give up. Sometimes you gotta let go... Just don't let anyone change who you are, 'kay?",
    author: "Johnny Silverhand"
  },
  {
    text: "Think this is it, kiddo.",
    author: "Johnny Silverhand"
  },
  {
    text: "They say pain's a deal between body and brain. You can break it, throw the pain away, bury it. Whole lotta horseshit.",
    author: "Rosalind Myers"
  },
  {
    text: "I don't know how much they're paying you, but you better ask yourself — is it worth it?",
    author: "Solomon Reed"
  },
  {
    text: "What I built, I built with my own two hands.",
    author: "Kurt Hansen"
  },
  {
    text: "I won't give you their ranks. I'd rather remember their names. Too many names to count.",
    author: "Kurt Hansen"
  },
  {
    text: "We did everything we were ordered to do, and then the brass decided to flush us down the storm drain.",
    author: "Kurt Hansen"
  },
  {
    text: "I should be saying they tried to kill me, but sometimes feels like they actually succeeded.",
    author: "Solomon Reed"
  },
  {
    text: "I know what they made you do. They pushed and pushed, and I wasn't there to stop it.",
    author: "Solomon Reed"
  },
  {
    text: "We got in, we can get out. Just trust me.",
    author: "Solomon Reed"
  },
  {
    text: "I know what I've done. Know the price I've paid. What you don't know is how sorry I am, how much it all hurts.",
    author: "Songbird"
  },
  {
    text: "We all make wrong turns, we all lose the way, and we kneel to pick up the broken pieces.",
    author: "Songbird"
  },
  {
    text: "Usually when you look out for yourself, it's others who pay the price.",
    author: "V"
  },
  {
    text: "I can't take it anymore... I need to escape...",
    author: "Songbird"
  },
  {
    text: "What do you suggest I do, see a therapist? Shrinks detest vehicles, we have no mothers!",
    author: "Delamain AI"
  },
  {
    text: "This is why you don't bring back fallen warriors. Sooner or later, they're going to see everything they fought for's turned to shit.",
    author: "Johnny Silverhand"
  },
  {
    text: "They'd say you're taking too big a risk. Poetically speaking, flying toward the sun to burn up.",
    author: "Mr. Blue Eyes"
  },
  {
    text: "Fashion is a weapon. Used properly, it can be lethal.",
    author: "Aurore Cassel"
  },
  {
    text: "All or nothin' — whaddaya say?",
    author: "Aurore Cassel"
  },
  {
    text: "Have a taste for risk?",
    author: "Aurore Cassel"
  }
];

/** A fresh quote every time the page opens - the original picked one per mount and kept it. */
export function randomQuote() {
  return QUOTES[Math.floor(Math.random() * QUOTES.length)] ?? QUOTES[0];
}
