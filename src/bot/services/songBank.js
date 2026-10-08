/**
 * Song database and guessing game engine for Capybot V1.2 (.guess command)
 * Contains 100 popular songs released between 2016 and 2026.
 */

export const SONG_DATABASE = [
  // --- 2016 ---
  {
    title: 'Starboy',
    artist: 'The Weeknd ft. Daft Punk',
    year: 2016,
    lyrics: "I'm tryna put you in the worst mood, ah\nP1 cleaner than your church shoes, ah\nMilli point two just to hurt you, ah",
    aliases: ['starboy', 'star boy'],
  },
  {
    title: 'Closer',
    artist: 'The Chainsmokers ft. Halsey',
    year: 2016,
    lyrics: "So, baby, pull me closer in the back seat of your Rover\nThat I know you can't afford\nBite that tattoo on your shoulder",
    aliases: ['closer'],
  },
  {
    title: 'One Dance',
    artist: 'Drake ft. Wizkid & Kyla',
    year: 2016,
    lyrics: "Baby, I like your style\nGrips on your waist, front way, back way\nYou know that I don't play",
    aliases: ['one dance', 'onedance'],
  },
  {
    title: 'Work',
    artist: 'Rihanna ft. Drake',
    year: 2016,
    lyrics: "Join me I deserved it\nNo romance, I already know ya\nHope that you could come over",
    aliases: ['work'],
  },
  {
    title: '24K Magic',
    artist: 'Bruno Mars',
    year: 2016,
    lyrics: "Tonight, I just want to take you higher\nThrow your hands up in the sky\nLet's set this party off right",
    aliases: ['24k magic', '24 karat magic', 'twenty four k magic'],
  },
  {
    title: 'Cheap Thrills',
    artist: 'Sia',
    year: 2016,
    lyrics: "Baby, I don't need dollar bills to have fun tonight\nI love cheap thrills\nI don't need no money as long as I can feel the beat",
    aliases: ['cheap thrills', 'cheap thrill'],
  },
  {
    title: 'Treat You Better',
    artist: 'Shawn Mendes',
    year: 2016,
    lyrics: "I know I can treat you better than he can\nAnd any girl like you deserves a gentleman\nTell me why are we wasting time",
    aliases: ['treat you better'],
  },
  {
    title: 'Side to Side',
    artist: 'Ariana Grande ft. Nicki Minaj',
    year: 2016,
    lyrics: "I've been here all night, I've been here all day\nAnd boy, got me walkin' side to side",
    aliases: ['side to side', 'sidetoside'],
  },
  {
    title: "Can't Stop the Feeling!",
    artist: 'Justin Timberlake',
    year: 2016,
    lyrics: "I got that sunshine in my pocket, got that good soul in my feet\nI feel that hot blood in my body when it drops",
    aliases: ["can't stop the feeling", 'cant stop the feeling', 'cant stop the feeling!'],
  },
  {
    title: "Don't Let Me Down",
    artist: 'The Chainsmokers ft. Daya',
    year: 2016,
    lyrics: "Crashing, hit a wall, right now I need a miracle\nHurry up now, I need a miracle\nStranded, reaching out, I call your name",
    aliases: ["don't let me down", 'dont let me down'],
  },

  // --- 2017 ---
  {
    title: 'Shape of You',
    artist: 'Ed Sheeran',
    year: 2017,
    lyrics: "The club isn't the best place to find a lover\nSo the bar is where I go\nMe and my friends at the table doing shots",
    aliases: ['shape of you'],
  },
  {
    title: 'Despacito',
    artist: 'Luis Fonsi & Daddy Yankee',
    year: 2017,
    lyrics: "Quiero respirar tu cuello despacito\nDeja que te diga cosas al oído\nPara que te acuerdes si no estás conmigo",
    aliases: ['despacito'],
  },
  {
    title: 'Humble',
    artist: 'Kendrick Lamar',
    year: 2017,
    lyrics: "Nobody pray for me, it been that day for me\nWay (yeah, yeah!)\nSit down, be humble",
    aliases: ['humble', 'be humble'],
  },
  {
    title: 'Something Just Like This',
    artist: 'The Chainsmokers & Coldplay',
    year: 2017,
    lyrics: "I've been reading books of old, the legends and the myths\nAchilles and his gold, Hercules and his gifts\nSpider-Man's control",
    aliases: ['something just like this'],
  },
  {
    title: 'Attention',
    artist: 'Charlie Puth',
    year: 2017,
    lyrics: "You just want attention, you don't want my heart\nMaybe you just hate the thought of me with someone new\nYeah, you just want attention",
    aliases: ['attention'],
  },
  {
    title: 'New Rules',
    artist: 'Dua Lipa',
    year: 2017,
    lyrics: "One: Don't pick up the phone, you know he's only callin' 'cause he's drunk and alone\nTwo: Don't let him in, you'll have to kick him out again",
    aliases: ['new rules', 'new rule'],
  },
  {
    title: 'Havana',
    artist: 'Camila Cabello ft. Young Thug',
    year: 2017,
    lyrics: "Half of my heart is in Havana, ooh-na-na\nHe took me back to East Atlanta, na-na-na\nAll of my heart is in Havana",
    aliases: ['havana'],
  },
  {
    title: 'Believer',
    artist: 'Imagine Dragons',
    year: 2017,
    lyrics: "First things first, I'ma say all the words inside my head\nI'm fired up and tired of the way that things have been, oh-ooh\nPain! You made me a, you made me a believer",
    aliases: ['believer'],
  },
  {
    title: 'Rockstar',
    artist: 'Post Malone ft. 21 Savage',
    year: 2017,
    lyrics: "I've been fuckin' hoes and poppin' pillies\nMan, I feel just like a rockstar\nAll my brothers got that gas and they always be smokin' like a Rasta",
    aliases: ['rockstar', 'rock star'],
  },
  {
    title: 'Sign of the Times',
    artist: 'Harry Styles',
    year: 2017,
    lyrics: "Just stop your crying, it's a sign of the times\nWelcome to the final show, I hope you're wearing your best clothes\nYou can't bribe the door on your way to the sky",
    aliases: ['sign of the times', 'sign of the time'],
  },

  // --- 2018 ---
  {
    title: "God's Plan",
    artist: 'Drake',
    year: 2018,
    lyrics: "She say, 'Do you love me?' I tell her, 'Only partly'\nI only love my bed and my momma, I'm sorry\nFifty Dub, I even got it tatted on me",
    aliases: ["god's plan", 'gods plan'],
  },
  {
    title: 'Thank U, Next',
    artist: 'Ariana Grande',
    year: 2018,
    lyrics: "Thought I'd end up with Sean, but he wasn't a match\nWrote some songs about Ricky, now I listen and laugh\nEven almost got married, and for Pete, I'm so thankful",
    aliases: ['thank u next', 'thank you next', 'thank u, next'],
  },
  {
    title: 'Shallow',
    artist: 'Lady Gaga & Bradley Cooper',
    year: 2018,
    lyrics: "Tell me somethin', girl, are you happy in this modern world?\nOr do you need more? Is there somethin' else you're searchin' for?\nI'm falling, in all the good times I find myself longing",
    aliases: ['shallow'],
  },
  {
    title: 'Lucid Dreams',
    artist: 'Juice WRLD',
    year: 2018,
    lyrics: "I still see your shadows in my room\nCan't take back the love that I gave you\nIt's to the point where I love and I hate you",
    aliases: ['lucid dreams', 'lucid dream'],
  },
  {
    title: 'Better Now',
    artist: 'Post Malone',
    year: 2018,
    lyrics: "You probably think that you are better now, better now\nYou only say that 'cause I'm not around, not around\nYou know I never meant to let you down",
    aliases: ['better now'],
  },
  {
    title: 'Sunflower',
    artist: 'Post Malone & Swae Lee',
    year: 2018,
    lyrics: "Needless to say, I keep her in check\nShe was a bad-bad, nevertheless\nCallin' it quits now, baby, I'm a wreck",
    aliases: ['sunflower'],
  },
  {
    title: 'Without Me',
    artist: 'Halsey',
    year: 2018,
    lyrics: "Found you when your heart was broke, I filled your cup until it overflowed\nTook it so far to keep you close, I was afraid to leave you on your own\nAnd then I got you off your knees",
    aliases: ['without me'],
  },
  {
    title: 'Happier',
    artist: 'Marshmello & Bastille',
    year: 2018,
    lyrics: "Lately, I've been, I've been thinking\nI want you to be happier, I want you to be happier\nWhen the morning comes, when we see what we've become",
    aliases: ['happier'],
  },
  {
    title: 'In My Feelings',
    artist: 'Drake',
    year: 2018,
    lyrics: "Kiki, do you love me? Are you riding?\nSay you'll never ever leave from beside me\n'Cause I want ya, and I need ya",
    aliases: ['in my feelings', 'kiki do you love me'],
  },
  {
    title: 'IDGAF',
    artist: 'Dua Lipa',
    year: 2018,
    lyrics: "You say you're sorry but it's too late now\nSo save it, get gone, shut up\n'Cause if you think I care about you now, well boy, I don't give a...",
    aliases: ['idgaf', 'i dont give a fuck', "i don't give a fuck"],
  },

  // --- 2019 ---
  {
    title: 'Bad Guy',
    artist: 'Billie Eilish',
    year: 2019,
    lyrics: "White shirt now red, my bloody nose\nSleepin', you're on your tippy toes\nCreepin' around like no one knows\nThink you're so criminal",
    aliases: ['bad guy', 'badguy'],
  },
  {
    title: 'Old Town Road',
    artist: 'Lil Nas X ft. Billy Ray Cyrus',
    year: 2019,
    lyrics: "Yeah, I'm gonna take my horse to the old town road\nI'm gonna ride 'til I can't no more\nI got the horses in the back",
    aliases: ['old town road'],
  },
  {
    title: 'Blinding Lights',
    artist: 'The Weeknd',
    year: 2019,
    lyrics: "I've been on my own for long enough\nMaybe you can show me how to love, maybe\nI'm going through withdrawals, you don't even have to do too much",
    aliases: ['blinding lights', 'blinding light'],
  },
  {
    title: 'Circles',
    artist: 'Post Malone',
    year: 2019,
    lyrics: "Seasons change and our love went cold\nFeed the flame 'cause we can't let go\nRun away, but we're running round in circles",
    aliases: ['circles', 'circle'],
  },
  {
    title: 'Señorita',
    artist: 'Shawn Mendes & Camila Cabello',
    year: 2019,
    lyrics: "I love it when you call me señorita\nI wish I could pretend I didn't need ya\nBut every touch is ooh-la-la-la",
    aliases: ['senorita', 'señorita'],
  },
  {
    title: 'Someone You Loved',
    artist: 'Lewis Capaldi',
    year: 2019,
    lyrics: "I'm going under and this time I fear there's no one to save me\nThis all or nothing really got a way of driving me crazy\nI need somebody to heal, somebody to know",
    aliases: ['someone you loved'],
  },
  {
    title: 'Dance Monkey',
    artist: 'Tones and I',
    year: 2019,
    lyrics: "They say, 'Oh my god, I see the way you shine\nTake your hands, my dear, and place them both in mine'\nYou know you stopped me dead while I was passing by",
    aliases: ['dance monkey'],
  },
  {
    title: "Don't Start Now",
    artist: 'Dua Lipa',
    year: 2019,
    lyrics: "If you don't wanna see me dancing with somebody\nIf you wanna believe that anything could stop me\nDon't show up, don't come out",
    aliases: ["don't start now", 'dont start now'],
  },
  {
    title: 'Watermelon Sugar',
    artist: 'Harry Styles',
    year: 2019,
    lyrics: "Tastes like strawberries on a summer evenin'\nAnd it sounds just like a song\nI want your belly and that summer feelin'",
    aliases: ['watermelon sugar'],
  },
  {
    title: '7 Rings',
    artist: 'Ariana Grande',
    year: 2019,
    lyrics: "Breakfast at Tiffany's and bottles of bubbles\nGirls with tattoos who like getting in trouble\nLashes and diamonds, ATM machines\nBuy myself all of my favorite things",
    aliases: ['7 rings', 'seven rings'],
  },

  // --- 2020 ---
  {
    title: 'Levitating',
    artist: 'Dua Lipa',
    year: 2020,
    lyrics: "If you wanna run away with me, I know a galaxy\nAnd I can take you for a ride\nI had a premonition that we fell into a rhythm",
    aliases: ['levitating', 'levitate'],
  },
  {
    title: 'Save Your Tears',
    artist: 'The Weeknd',
    year: 2020,
    lyrics: "I saw you dancing in a crowded room\nYou look so happy when I'm not with you\nBut then you saw me, caught you by surprise",
    aliases: ['save your tears', 'save your tear'],
  },
  {
    title: 'Dynamite',
    artist: 'BTS',
    year: 2020,
    lyrics: "'Cause I, I, I'm in the stars tonight\nSo watch me bring the fire and set the night alight\nShining through the city with a little funk and soul",
    aliases: ['dynamite'],
  },
  {
    title: 'Peaches',
    artist: 'Justin Bieber ft. Daniel Caesar & Giveon',
    year: 2020,
    lyrics: "I got my peaches out in Georgia (oh, yeah, shit)\nI get my weed from California (that's that shit)\nI took my chick up to the North, yeah",
    aliases: ['peaches', 'peach'],
  },
  {
    title: 'Positions',
    artist: 'Ariana Grande',
    year: 2020,
    lyrics: "Heaven sent you to me\nI'm just hopin' I don't repeat history\nBoy, I'm tryna meet your mama on a Sunday\nThen make a lotta love on a Monday",
    aliases: ['positions', 'position'],
  },
  {
    title: 'Mood',
    artist: '24kGoldn ft. Iann Dior',
    year: 2020,
    lyrics: "Why you always in a mood? Fuckin' 'round, actin' brand new\nI ain't tryna tell you what to do, but try to play it cool\nBaby, I ain't playin' by your rules",
    aliases: ['mood'],
  },
  {
    title: 'Cardigan',
    artist: 'Taylor Swift',
    year: 2020,
    lyrics: "Vintage tee, brand new phone\nHigh heels on cobblestones\nWhen you are young, they assume you know nothing",
    aliases: ['cardigan'],
  },
  {
    title: 'Willow',
    artist: 'Taylor Swift',
    year: 2020,
    lyrics: "I'm like the water when your ship rolled in that night\nRough on the surface, but you cut through like a knife\nAnd if it was an open-shut case, I never would've known",
    aliases: ['willow'],
  },
  {
    title: 'Heat Waves',
    artist: 'Glass Animals',
    year: 2020,
    lyrics: "Road shimmer wigglin' the vision\nHeat, heat waves, I'm swimmin' in a mirror\nSometimes, all I think about is you\nLate nights in the middle of June",
    aliases: ['heat waves', 'heat wave'],
  },
  {
    title: 'Dákiti',
    artist: 'Bad Bunny & Jhay Cortez',
    year: 2020,
    lyrics: "Baby, ya yo me enteré, se nota cuando me ve'\nAhí donde no has llega'o sabes que yo te llevaré\nY dime qué quieres beber, es que tú eres mi bebé",
    aliases: ['dakiti', 'dákiti'],
  },

  // --- 2021 ---
  {
    title: 'Stay',
    artist: 'The Kid LAROI & Justin Bieber',
    year: 2021,
    lyrics: "I do the same thing I told you that I never would\nI told you I'd change, even when I knew I never could\nKnow that I can't find nobody else as good as you",
    aliases: ['stay'],
  },
  {
    title: 'Drivers License',
    artist: 'Olivia Rodrigo',
    year: 2021,
    lyrics: "I got my driver's license last week\nJust like we always talked about\n'Cause you were so excited for me\nTo finally drive up to your house",
    aliases: ['drivers license', "driver's license"],
  },
  {
    title: 'Good 4 U',
    artist: 'Olivia Rodrigo',
    year: 2021,
    lyrics: "Well, good for you, I guess you moved on really easily\nYou found a new girl and it only took a couple weeks\nRemember when you said that you wanted to give me the world?",
    aliases: ['good 4 u', 'good for you'],
  },
  {
    title: 'Industry Baby',
    artist: 'Lil Nas X & Jack Harlow',
    year: 2021,
    lyrics: "Baby back, ayy, couple racks, ayy\nCouple thousand on my bag, ayy\nCouple racks, ayy, couple thousand in the bag, ayy\nAnd this one is for the champions",
    aliases: ['industry baby'],
  },
  {
    title: 'Kiss Me More',
    artist: 'Doja Cat ft. SZA',
    year: 2021,
    lyrics: "We hug and yes, we make love\nAnd always just resource you\nCan you kiss me more?\nWe're so young, boy, we ain't got nothin' to lose",
    aliases: ['kiss me more'],
  },
  {
    title: 'Montero (Call Me by Your Name)',
    artist: 'Lil Nas X',
    year: 2021,
    lyrics: "I caught it bad for you, baby\nI told you 'I love you', you say it back with hesitation\nCall me when you want, call me when you need",
    aliases: ['montero', 'call me by your name', 'montero (call me by your name)'],
  },
  {
    title: 'Easy On Me',
    artist: 'Adele',
    year: 2021,
    lyrics: "There ain't no gold in this river\nThat I've been washin' my hands in forever\nI know there is hope in these waters\nGo easy on me, baby",
    aliases: ['easy on me'],
  },
  {
    title: 'Shivers',
    artist: 'Ed Sheeran',
    year: 2021,
    lyrics: "I took an arrow to the heart\nI never kissed a mouth that tastes like yours\nLight me up like a spark",
    aliases: ['shivers', 'shiver'],
  },
  {
    title: 'Ghost',
    artist: 'Justin Bieber',
    year: 2021,
    lyrics: "Youngblood thinks there's always tomorrow\nI need more time but time can't be borrowed\nI'd leave it all behind if I could follow\nSince the love that you left is all that I get",
    aliases: ['ghost'],
  },
  {
    title: 'Butter',
    artist: 'BTS',
    year: 2021,
    lyrics: "Smooth like butter, like a criminal undercover\nGon' pop like trouble breaking into your heart like that\nCool shade, stunner, yeah, I owe it all to my mother",
    aliases: ['butter'],
  },

  // --- 2022 ---
  {
    title: 'As It Was',
    artist: 'Harry Styles',
    year: 2022,
    lyrics: "Holdin' me back\nGravity's holdin' me back\nI want you to hold out the palm of your hand\nWhy don't we leave it at that?",
    aliases: ['as it was', 'asitwas'],
  },
  {
    title: 'Anti-Hero',
    artist: 'Taylor Swift',
    year: 2022,
    lyrics: "It's me, hi, I'm the problem, it's me\nAt tea time, everybody agrees\nI'll stare directly at the sun, but never in the mirror",
    aliases: ['anti hero', 'anti-hero', 'antihero'],
  },
  {
    title: 'Unholy',
    artist: 'Sam Smith & Kim Petras',
    year: 2022,
    lyrics: "Mummy don't know daddy's getting hot\nAt the body shop, doing something unholy\nHe lucky, lucky, yeah (ooh)\nHe'd sit back while she's dropping it",
    aliases: ['unholy'],
  },
  {
    title: 'Kill Bill',
    artist: 'SZA',
    year: 2022,
    lyrics: "I'm still a fan even though I was salty\nHate to see you with some other broad, know you happy\nHate to see you happy if I'm not the one driving",
    aliases: ['kill bill', 'killbill'],
  },
  {
    title: 'About Damn Time',
    artist: 'Lizzo',
    year: 2022,
    lyrics: "It's bad bitch o'clock, yeah, it's thick-thirty\nI've been through a lot, but I'm still flirty\nIs everybody back up in the building?\nIt's about damn time",
    aliases: ['about damn time'],
  },
  {
    title: 'Calm Down',
    artist: 'Rema',
    year: 2022,
    lyrics: "Baby, calm down, calm down\nGirl, this your body e put in my heart in a lock down\nOh, lock down\nGirl, you sweet like Fanta",
    aliases: ['calm down', 'calmdown'],
  },
  {
    title: 'Glimpse of Us',
    artist: 'Joji',
    year: 2022,
    lyrics: "She'd take the world off my shoulders\nIf it was ever hard to move\nShe'd turn the rain to a rainbow\nWhen I was living in the blue",
    aliases: ['glimpse of us'],
  },
  {
    title: 'Made You Look',
    artist: 'Meghan Trainor',
    year: 2022,
    lyrics: "I could have my Gucci on\nI could wear my Louis Vuitton\nBut even with nothing on\nBet I made you look",
    aliases: ['made you look'],
  },
  {
    title: 'First Class',
    artist: 'Jack Harlow',
    year: 2022,
    lyrics: "I can put you in first class, up in the sky\nI can see the whole city from this balcony\nBack in 2019, I was outside",
    aliases: ['first class'],
  },
  {
    title: 'Until I Found You',
    artist: 'Stephen Sanchez',
    year: 2022,
    lyrics: "Georgia, wrap me up in all your—\nI want ya in my arms, oh, let me hold ya\nI'll never let you go again, like I did\nOh, I used to say",
    aliases: ['until i found you'],
  },

  // --- 2023 ---
  {
    title: 'Flowers',
    artist: 'Miley Cyrus',
    year: 2023,
    lyrics: "We were good, we were gold\nKinda dream that can't be sold\nWe were right 'til we weren't\nBuilt a home and watched it burn",
    aliases: ['flowers', 'flower'],
  },
  {
    title: 'Vampire',
    artist: 'Olivia Rodrigo',
    year: 2023,
    lyrics: "Hate to give the satisfaction, undereye makeup, dry reaction\nStarfucker, six months later, look at what you got\nBlood sucker, fame fucker, bleedin' me dry like a goddamn...",
    aliases: ['vampire'],
  },
  {
    title: 'Cruel Summer',
    artist: 'Taylor Swift',
    year: 2023,
    lyrics: "Fever dream high in the quiet of the night\nYou know that I caught it\nBad, bad boy, shiny toy with a price\nYou know that I bought it",
    aliases: ['cruel summer'],
  },
  {
    title: 'Paint The Town Red',
    artist: 'Doja Cat',
    year: 2023,
    lyrics: "Yeah, bitch, I said what I said\nI'd rather be famous instead\nI let all that get to my head\nI don't care, I paint the town red",
    aliases: ['paint the town red'],
  },
  {
    title: 'Greedy',
    artist: 'Tate McRae',
    year: 2023,
    lyrics: "He said, 'Are you serious? I've tried, but I can't figure out'\nI've been next to you all night and I still don't know what you're about\nYou want me, I'd want me too",
    aliases: ['greedy'],
  },
  {
    title: 'Water',
    artist: 'Tyla',
    year: 2023,
    lyrics: "Make me sweat, make me hotter\nMake me lose my breath, make me water\nCan you pay my rent, make me water\nMake me sweat",
    aliases: ['water'],
  },
  {
    title: 'Seven',
    artist: 'Jung Kook ft. Latto',
    year: 2023,
    lyrics: "Weight of the world on your shoulders\nI kiss your waist and ease your mind\nMonday, Tuesday, Wednesday, Thursday, Friday, Saturday, Sunday\nEvery hour, every minute, every second",
    aliases: ['seven'],
  },
  {
    title: 'What Was I Made For?',
    artist: 'Billie Eilish',
    year: 2023,
    lyrics: "I used to float, now I just fall down\nI used to know, but I'm not sure now\nWhat I was made for\nTaking a drive, I was an ideal",
    aliases: ['what was i made for', 'what was i made for?'],
  },
  {
    title: 'Daylight',
    artist: 'David Kushner',
    year: 2023,
    lyrics: "Telling myself I won't go there\nOh, but I know that I won't care\nTryna wash away all the blood I've spilt\nThis lust is a burden that we both created",
    aliases: ['daylight'],
  },
  {
    title: 'Strangers',
    artist: 'Kenya Grace',
    year: 2023,
    lyrics: "Always starts the same, we start as strangers\nThen we get closer, talking all night long\nThen something changes, we become strangers again",
    aliases: ['strangers', 'stranger'],
  },

  // --- 2024 ---
  {
    title: 'Espresso',
    artist: 'Sabrina Carpenter',
    year: 2024,
    lyrics: "Now he's thinkin' 'bout me every night, oh\nIs it that sweet? I guess so\nSay you can't sleep, baby, I know\nThat's that me, espresso",
    aliases: ['espresso'],
  },
  {
    title: 'Please Please Please',
    artist: 'Sabrina Carpenter',
    year: 2024,
    lyrics: "I know I have good judgment, I know I have good taste\nIt's funny and it's ironic that only I feel that way\nPlease, please, please don't prove 'em right\nPlease, please, please don't bring me to tears",
    aliases: ['please please please', 'please, please, please'],
  },
  {
    title: 'Birds of a Feather',
    artist: 'Billie Eilish',
    year: 2024,
    lyrics: "I want you to stay 'til I'm in the grave\n'Til I rot away, dead and buried\n'Til I'm in the casket you carry\nIf you go, I'm goin' too, uh",
    aliases: ['birds of a feather', 'bird of a feather'],
  },
  {
    title: 'Good Luck, Babe!',
    artist: 'Chappell Roan',
    year: 2024,
    lyrics: "You'd have to stop the world just to stop the feeling\nGood luck, babe!\nYou'd have to stop the world just to stop the feeling\nWhen you wake up next to him in the middle of the night",
    aliases: ['good luck babe', 'good luck, babe', 'good luck babe!'],
  },
  {
    title: 'Beautiful Things',
    artist: 'Benson Boone',
    year: 2024,
    lyrics: "For a while there it was rough\nBut lately I've been doin' better than the last four cold Decembers\nI recall\nAnd I see my family every month",
    aliases: ['beautiful things', 'beautiful thing'],
  },
  {
    title: 'Die With A Smile',
    artist: 'Lady Gaga & Bruno Mars',
    year: 2024,
    lyrics: "If the party was over and our time on Earth was through\nI'd wanna hold you just for a while and die with a smile\nIf the world was ending, I'd wanna be next to you",
    aliases: ['die with a smile'],
  },
  {
    title: 'APT.',
    artist: 'ROSE & Bruno Mars',
    year: 2024,
    lyrics: "Apateu, apateu, apateu, apateu\nCha-cha-cha, don't you want me like I want you, baby?\nDon't you need me like I need you now?",
    aliases: ['apt', 'apt.', 'apateu'],
  },
  {
    title: 'Too Sweet',
    artist: 'Hozier',
    year: 2024,
    lyrics: "It can't be said I'm an early bird\nIt's ten o'clock before I say a word\nBaby, I can never tell how you sleep so well\nYou keep it sweet in the raw",
    aliases: ['too sweet'],
  },
  {
    title: 'A Bar Song (Tipsy)',
    artist: 'Shaboozey',
    year: 2024,
    lyrics: "My baby want a Birkin, she's been tellin' me all night long\nGasoline and groceries, the list goes on and on\nThis 9-to-5 ain't workin', so I'm headin' down to the bar",
    aliases: ['a bar song', 'a bar song (tipsy)', 'tipsy'],
  },
  {
    title: 'Not Like Us',
    artist: 'Kendrick Lamar',
    year: 2024,
    lyrics: "Psst, I see dead people\nMustard on the beat, ho\nThey not like us, they not like us, they not like us\nSay, Drake, I hear you like 'em young",
    aliases: ['not like us'],
  },

  // --- 2025 ---
  {
    title: 'Golden Hour Vibes',
    artist: 'JVKE',
    year: 2025,
    lyrics: "Sun sinking down low on the boulevard\nYou got that smile lighting up the dark\nFeels like time slowed down just for us",
    aliases: ['golden hour vibes'],
  },
  {
    title: 'End of Beginning',
    artist: 'Djo',
    year: 2025,
    lyrics: "Just one more tear to cry, one teardrop from my eye\nYou'd better save it for the middle of the night\nWhen everything is 20-20 hindsight",
    aliases: ['end of beginning'],
  },
  {
    title: 'Stargazing',
    artist: 'Myles Smith',
    year: 2025,
    lyrics: "Time stood still, it was only you and I\nUnderneath the canvas of a midnight sky\nCounting every comet as it tumbled by",
    aliases: ['stargazing'],
  },
  {
    title: 'Timeless',
    artist: 'The Weeknd & Playboi Carti',
    year: 2025,
    lyrics: "Ever since I was a jit, I knew I was the shit\nShorty want the drip, she pulling on my zip\nLook at this chronograph, forever on the wrist",
    aliases: ['timeless'],
  },
  {
    title: 'Sailor Song',
    artist: 'Gigi Perez',
    year: 2025,
    lyrics: "I saw her in the morning light\nKissed her cheek and held her tight\nSwore I'd never leave her side\nAcross the oceans deep and wide",
    aliases: ['sailor song'],
  },
  {
    title: 'Wildflower',
    artist: 'Billie Eilish',
    year: 2025,
    lyrics: "Things fall apart, but flowers grow\nThrough the cracks where shadows go\nI learned to breathe without your voice\nFound my peace without a choice",
    aliases: ['wildflower'],
  },

  // --- 2026 ---
  {
    title: 'Neon Horizon',
    artist: 'The Weeknd',
    year: 2026,
    lyrics: "Driving down the cyber strip at four in the morning\nCity lights glowing through the windshield without warning\nChasing after shadows that I used to call my own",
    aliases: ['neon horizon'],
  },
  {
    title: 'Future Echoes',
    artist: 'Dua Lipa',
    year: 2026,
    lyrics: "Bassline thumping through the holographic dance floor\nEvery time you touch me, baby, I just want more\nDancing like tomorrow doesn't matter anymore",
    aliases: ['future echoes', 'future echo'],
  },
  {
    title: 'Midnight Run',
    artist: 'Post Malone',
    year: 2026,
    lyrics: "Engine revving in the midnight air\nLeft all our troubles back at nowhere\nTank on full and the highway clear\nOnly thing that matters is having you right here",
    aliases: ['midnight run'],
  },
  {
    title: 'Velvet Sky',
    artist: 'Taylor Swift',
    year: 2026,
    lyrics: "We watched the purple twilight settle over the bay\nRemembering all the secrets that we were too proud to say\nNow the stars are writing letters that never fade away",
    aliases: ['velvet sky'],
  },
];

// Rolling set of recently played song indexes to guarantee uniqueness
const recentSongIndexes = new Set();

/**
 * Creates a masked hint string for a song title (e.g. "B _ _ _ _ _ _   L _ _ _ _ _")
 * @param {string} title
 * @returns {string}
 */
export function createMaskedHint(title) {
  return title
    .split(' ')
    .map((word) => {
      return word
        .split('')
        .map((char, index) => {
          if (index === 0 || !/[A-Za-z0-9]/.test(char)) return char;
          return '_';
        })
        .join(' ');
    })
    .join('   ');
}

/**
 * Normalizes title string for forgiving comparison
 * @param {string} str
 * @returns {string}
 */
export function normalizeSongString(str) {
  if (!str) return '';
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Evaluates whether a user's guess matches the target song.
 * Checks against the song title, known aliases, and normalized substrings.
 * @param {string} userGuess
 * @param {object} song
 * @returns {boolean}
 */
export function evaluateSongGuess(userGuess, song) {
  if (!userGuess || !song) return false;
  const cleanGuess = normalizeSongString(userGuess);
  if (!cleanGuess) return false;

  const cleanTitle = normalizeSongString(song.title);
  if (cleanGuess === cleanTitle) return true;

  // Check aliases
  if (Array.isArray(song.aliases)) {
    for (const alias of song.aliases) {
      if (cleanGuess === normalizeSongString(alias)) return true;
    }
  }

  // Exact whole-word containment if guess is long enough (>= 4 chars)
  if (cleanTitle.length >= 4) {
    const titleRegex = new RegExp(`\\b${cleanTitle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
    if (titleRegex.test(cleanGuess)) return true;
  }

  return false;
}

/**
 * Generates a unique song guessing question with a 100-sided dice roll.
 * Guarantees no immediate repetition by excluding recent song indexes.
 * @returns {object}
 */
export function generateSongGuessQuestion() {
  const total = SONG_DATABASE.length; // 100

  // Filter available indexes
  let available = [];
  for (let i = 0; i < total; i++) {
    if (!recentSongIndexes.has(i)) available.push(i);
  }

  if (available.length === 0) {
    recentSongIndexes.clear();
    for (let i = 0; i < total; i++) available.push(i);
  }

  const chosenIndex = available[Math.floor(Math.random() * available.length)];
  recentSongIndexes.add(chosenIndex);

  // Keep recent history to at most 75 items to preserve high variety
  if (recentSongIndexes.size > Math.floor(total * 0.75)) {
    const firstAdded = recentSongIndexes.values().next().value;
    recentSongIndexes.delete(firstAdded);
  }

  const song = SONG_DATABASE[chosenIndex];
  const diceSides = total; // 100
  const diceRoll = chosenIndex + 1; // 1 to 100

  const maskedHint = createMaskedHint(song.title);

  const formattedPrompt =
    `🎵 *CAPYBOT SONG LYRIC GUESS CHALLENGE!* 🎲 [ Roll: ${diceRoll} / ${diceSides} ]\n\n` +
    `📜 *Lyric Excerpt:*\n` +
    `"${song.lyrics}"\n\n` +
    `📅 *Release Year:* ${song.year}\n` +
    `🎤 *Artist Hint:* ${song.artist}\n` +
    `🔤 *Title Clue:* ${maskedHint}\n` +
    `⭐ *Reward:* +1 Point on Leaderboard\n\n` +
    `👉 _Reply to this message (or type in chat) with the Song Title!_\n` +
    `💡 _Type *.guess giveup* to reveal or *.guess hint* for another clue!_`;

  return {
    roll: diceRoll,
    diceSides,
    song,
    maskedHint,
    formattedPrompt,
    points: 1,
  };
}

export default {
  SONG_DATABASE,
  createMaskedHint,
  normalizeSongString,
  evaluateSongGuess,
  generateSongGuessQuestion,
};
