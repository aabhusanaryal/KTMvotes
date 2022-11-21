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
  result = [];
  try {
    // Fetch HTML of the page
    const { data } = await axios.get(url);
    // Load HTML we fetched in the previous line
    const $ = cheerio.load(data);
    const listItems = $(
      `.col-md-6:nth-child(${constituency}) .candidate-list__item`
    );
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
    constituency: "4",
    url: "https://election.ekantipur.com/pradesh-3/district-kathmandu?lng=eng",
  },
  {
    district: "Lalitpur",
    constituency: "3",
    url: "https://election.ekantipur.com/pradesh-3/district-lalitpur?lng=eng",
  },
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
  return "Done!";
}
async function main() {
  await populate();
  console.log(resultNew);
}

main();

function tweet(title) {
  let status = `------------------------------\n${title} Vote Count:\n------------------------------\n\n`;
  resultNew.slice(0, topCandidates).forEach((candidate) => {
    status += `${candidate.name}: ${candidate.votes.toLocaleString()}\n`;
  });

  status += "\n#LocalElections2022 #LocalElections2079";
  client.post("statuses/update", { status }, function (error, tweet, response) {
    if (error) throw error;
  });
}

function webhook(title) {
  const embed = new MessageBuilder()
    .setAuthor(
      `${title} Vote Count`,
      "https://upload.wikimedia.org/wikipedia/commons/thumb/e/ef/Election_Commission%2C_Nepal.svg/800px-Election_Commission%2C_Nepal.svg.png",
      url
    )
    .setColor("#42c700")
    .setFooter("Bot maintained by Aabhusan Aryal")
    .setTimestamp();

  resultNew.slice(0, topCandidates).forEach((candidate) => {
    embed.addField(candidate.name, candidate.votes.toLocaleString());
  });
  hooks.forEach((hook) => {
    hook.send(embed);
  });
}
