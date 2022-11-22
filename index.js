require("dotenv").config();
const Twitter = require("twitter");
const axios = require("axios");
const cheerio = require("cheerio");
const { Webhook, MessageBuilder } = require("discord-webhook-node");

let webhookURLs = process.env.WEBHOOKS.split(" ");
const hooks = []; // array of Webhook objects

const client = new Twitter({
  consumer_key: process.env.CONSUMER_KEY,
  consumer_secret: process.env.CONSUMER_SECRET,
  access_token_key: process.env.ACCESS_TOKEN_KEY,
  access_token_secret: process.env.ACCESS_TOKEN_SECRET,
});

webhookURLs.forEach((url) => {
  const hook = new Webhook(url);
  hooks.push(hook);
});

let totalCandidates = 20; // currently, we're fetching the data of top 20 candidates only
let topCandidates = 3; // the number of candidates to display in tweet/ bot msg
let totalVotes = 0; // total votes secured by `totalCandidates`
let topVotes = 0; // total votes secured by `topCandidates`

let resultOld = [];
let resultNew = [];
// Elements:
// 0:
const interval = 1; // in minutes

// Fetching data
// setInterval(() => {
totalVotes = 0;
topVotes = 0;
// Moving the previous vote count to resultOld and adding new voute count in resultNew
resultOld = [...resultNew];

async function scrapeData(url, constituency) {
  try {
    // Fetch HTML of the page
    const { data } = await axios.get(url);
    // Load HTML we fetched in the previous line
    const $ = cheerio.load(data);
    const listItems = $(
      `.col-md-6:nth-child(${constituency}) .candidate-list__item`
    );
    result = [];
    // Looping through the list items
    listItems.each((idx, el) => {
      if (idx <= totalCandidates) {
        let candidateMeta = $(el)
          .children(".row")
          .children(".col")
          .children(".candidate-wrapper");

        let name = candidateMeta
          .children(".candidate-meta")
          .children(".nominee-name")
          .text();
        let votes = parseInt(candidateMeta.children(".vote-count").text());
        result.push({ name, votes });
      }
    });
    console.log("!!!!!", result);
    return result;
  } catch (err) {
    console.error(err);
  }
}

let places = [
  {
    district: "Dadeldhura",
    constituency: "1",
    url: "https://election.ekantipur.com/pradesh-7/district-dadeldhura?lng=eng",
  },
  {
    district: "Kathmandu",
    constituency: "1",
    url: "https://election.ekantipur.com/pradesh-3/district-kathmandu?lng=eng",
  },
  {
    district: "Kathmandu",
    constituency: "2",
    url: "https://election.ekantipur.com/pradesh-3/district-kathmandu?lng=eng",
  },
  {
    district: "Kathmandu",
    constituency: "4",
    url: "https://election.ekantipur.com/pradesh-3/district-kathmandu?lng=eng",
  },
  {
    district: "Kathmandu",
    constituency: "5",
    url: "https://election.ekantipur.com/pradesh-3/district-kathmandu?lng=eng",
  },
  {
    district: "Kathmandu",
    constituency: "8",
    url: "https://election.ekantipur.com/pradesh-3/district-kathmandu?lng=eng",
  },
  {
    district: "Lalitpur",
    constituency: "3",
    url: "https://election.ekantipur.com/pradesh-3/district-lalitpur?lng=eng",
  },
  {
    district: "Chitwan",
    constituency: "2",
    url: "https://election.ekantipur.com/pradesh-3/district-chitwan?lng=eng",
  },
  // {
  //   district: "Test",
  //   constituency: "1",
  //   url: "http://127.0.0.1:5500/Kathmandu%20_%20Province%203%20-%20Nepal%20Election%20Latest%20Updates%20and%20Result%20for%20Federal%20Parliament.html",
  // },
];

async function populate() {
  resultNew = [];
  for (let i = 0; i < places.length; i++) {
    let place = places[i];
    await scrapeData(place.url, place.constituency).then((result) => {
      resultNew.push({
        title: `${place.district}-${place.constituency}`,
        district: place.district,
        constituency: place.constituency,
        result: result,
      });
    });
  }
  return 1;
}

async function main() {
  await populate();
  if (resultOld.length === 0) {
    console.log("NEW RUN!!!");
    resultOld = [...resultNew];
    // In the first run, post all places' results
    resultNew.forEach((place) => {
      webhook(place);
    });
  } else {
    resultNew.forEach((place) => {
      old = resultOld.filter((p) => p.title == place.title)[0];
      console.log(place.title, place.result);
      if (
        (place.result[0]?.votes != old.result[0]?.votes ||
          place.result[1]?.votes != old.result[1]?.votes ||
          place.result[2]?.votes != old.result[2]?.votes) &&
        place.result.length != 0
      ) {
        webhook(place);
        tweet(place);
      }
    });
    resultOld = [...resultNew];
  }
}

main();
setInterval(main, 60 * 1000);

function tweet(place) {
  flag = 1; // will be 0 if any vote is NaN
  let status = `--------------------\n${place.title} Vote Count:\n--------------------\n\n`;
  place.result.slice(0, topCandidates).forEach((candidate) => {
    if (candidate.vote == NaN) {
      console.log("Vote is NaN");
      flag = 0;
    }
    status += `${candidate.name}: ${candidate.votes.toLocaleString()}\n`;
  });
  if (status.length < 250) status += "\n#Election2022 #Election2079";
  console.log("Tweeting...", status.length);
  console.log("\n\n", status);
  if (flag)
    client.post(
      "statuses/update",
      { status },
      function (error, tweet, response) {
        if (error) throw error;
      }
    );
}

function webhook(place) {
  const embed = new MessageBuilder()
    .setAuthor(
      `${place.title} Vote Count`,
      "https://upload.wikimedia.org/wikipedia/commons/thumb/e/ef/Election_Commission%2C_Nepal.svg/800px-Election_Commission%2C_Nepal.svg.png"
    )
    .setColor("#42c700")
    .setFooter("Bot maintained by Aabhusan Aryal")
    .setTimestamp();
  place.result.slice(0, topCandidates).forEach((candidate) => {
    embed.addField(candidate.name, candidate.votes.toLocaleString());
  });
  hooks.forEach((hook) => {
    hook.send(embed);
  });
}
