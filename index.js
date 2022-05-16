require("dotenv").config();
const Twitter = require("twitter");
const axios = require("axios");
const cheerio = require("cheerio");
const { Webhook, MessageBuilder } = require("discord-webhook-node");

const url = process.env.dataURL; // data URL
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

let resultOld = [{ name: "", votes: 0 }];
let resultNew = [{ name: "", votes: 0 }];
const interval = 0.1; // in minutes

// Fetching data
setInterval(() => {
  totalVotes = 0;
  topVotes = 0;
  webhookURLs = process.env.WEBHOOKS.split(" ");
  // Moving the previous vote count to resultOld and adding new voute count in resultNew
  resultOld = [...resultNew];

  async function scrapeData() {
    try {
      // Fetch HTML of the page
      const { data } = await axios.get(url);
      // Load HTML we fetched in the previous line
      const $ = cheerio.load(data);
      // Select all the list items in .candidate-list
      const listItems = $(".candidate-list");
      // Looping through the list items
      listItems.each((idx, el) => {
        if (idx <= totalCandidates) {
          const candidate = { name: "", votes: "" };
          let candidateMeta = $(el)
            .children(".row")
            .children(".col")
            .children(".candidate-meta-wrapper");
          let name = candidateMeta
            .children(".candidate-meta")
            .children(".candidate-name")
            .text();
          let votes =
            parseInt(candidateMeta.children(".vote-numbers").text()) | 0;
          // The site doesn't have vote count for people that haven't received any votes yet.
          // The |0 in the previous line converts those NaNs to 0
          totalVotes += votes;
          if (idx < topCandidates) topVotes += votes;
          resultNew[idx] = { name, votes };
        }
      });

      // Now, if the entries of resultOld and resultNew differ, it means we have an update
      // In that case, we push out a tweet and trigger webhook
      if (resultOld[0].votes != resultNew[0].votes) {
        tweet();
        webhook();
      }
    } catch (err) {
      console.error(err);
    }
  }
  // Invoke the above function
  scrapeData();
}, interval * (60 * 1000));

function tweet() {
  let status =
    "------------------------------\nKTM Metro Vote Count:\n------------------------------\n\n";
  resultNew.slice(0, topCandidates).forEach((candidate) => {
    status += `${candidate.name}: ${candidate.votes.toLocaleString()}\n`;
  });
  status += `Other: ${(totalVotes - topVotes).toLocaleString()}\n\n`;
  status += `Total Votes: ${totalVotes.toLocaleString()}\n`;
  status += "\n#LocalElections2022 #LocalElections2079";
  client.post("statuses/update", { status }, function (error, tweet, response) {
    if (error) throw error;
  });
}

function webhook() {
  const embed = new MessageBuilder()
    .setAuthor(
      "KTM Metro Vote Count",
      "https://media.discordapp.net/attachments/974998328104337438/975001919158382612/pexels-element-digital-1550337.jpg?width=1023&height=682",
      "https://election.ekantipur.com/pradesh-3/district-kathmandu/kathmandu?lng=eng"
    )
    .setColor("#42c700")
    .setFooter("Bot maintained by Aabhusan Aryal")
    .setTimestamp();

  resultNew.slice(0, topCandidates).forEach((candidate) => {
    embed.addField(candidate.name, candidate.votes.toLocaleString());
  });
  embed.addField("Other", (totalVotes - topVotes).toLocaleString(), true);
  embed.addField("Total Votes", totalVotes.toLocaleString(), true);
  hooks.forEach((hook) => {
    hook.send(embed);
  });
}
