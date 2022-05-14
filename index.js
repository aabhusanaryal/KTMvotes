require("dotenv").config();
const Twitter = require("twitter");
const axios = require("axios");
const cheerio = require("cheerio");
const pretty = require("pretty");
const { Webhook, MessageBuilder } = require("discord-webhook-node");

const url = process.env.dataURL;
let webhookURLs = process.env.WEBHOOKS.split(" ");
const hooks = [];

webhookURLs.forEach((url) => {
  const hook = new Webhook(url);
  hooks.push(hook);
});

const client = new Twitter({
  consumer_key: process.env.CONSUMER_KEY,
  consumer_secret: process.env.CONSUMER_SECRET,
  access_token_key: process.env.ACCESS_TOKEN_KEY,
  access_token_secret: process.env.ACCESS_TOKEN_SECRET,
});

let resultOld = [{ candidateName: "", candidateVote: 0 }];
let resultNew = [{ candidateName: "", candidateVote: 0 }];
const interval = 0.1; // in minutes
// Fetching data
setInterval(() => {
  webhookURLs = process.env.WEBHOOKS.split(" ");
  resultOld = [...resultNew]; // Moving the previous result to resultOld
  async function scrapeData() {
    try {
      // Fetch HTML of the page we want to scrape
      const { data } = await axios.get(url);
      // Load HTML we fetched in the previous line
      const $ = cheerio.load(data);
      // Select all the list items in plainlist class
      const listItems = $(".candidate-list");

      // Use .each method to loop through the li we selected
      listItems.each((idx, el) => {
        if (idx <= 3) {
          // Object holding data for each country/jurisdiction
          const candidate = { name: "", votes: "" };
          // Select the text content of a and span elements
          // Store the textcontent in the above object
          let candidateMeta = $(el)
            .children(".row")
            .children(".col")
            .children(".candidate-meta-wrapper");
          let candidateName = candidateMeta
            .children(".candidate-meta")
            .children(".candidate-name")
            .text();
          let candidateVote = candidateMeta.children(".vote-numbers").text();
          resultNew[idx] = { candidateName, candidateVote };
        }
      });

      // Now, if the entries of resultOld and resultNew differ, it means we have an update
      // In that case, we push out a tweet and trigger webhook

      if (resultOld[0].candidateVote != resultNew[0].candidateVote) {
        tweet();
        webhook();
      }
      // Logs countries array to the console
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
  resultNew.forEach((candidate) => {
    status += `${candidate.candidateName}: ${candidate.candidateVote}\n`;
  });
  status += "\n#LocalElections2022 #LocalElections2079";
  client.post("statuses/update", { status }, function (error, tweet, response) {
    if (error) throw error;
    console.log(tweet); // Tweet body.
    console.log(response); // Raw response object.
  });
}

function webhook() {
  const embed = new MessageBuilder()
    .setAuthor(
      "KTM Metro Vote Count",
      "https://media.discordapp.net/attachments/974998328104337438/975001919158382612/pexels-element-digital-1550337.jpg?width=1023&height=682",
      "https://election.ekantipur.com/pradesh-3/district-kathmandu/kathmandu?lng=eng"
    )
    // .setURL(`${url}${latestNotice.link}`)
    .setColor("#42c700")
    //   .setThumbnail("https://cdn.discordapp.com/embed/avatars/0.png")
    // .setDescription(`${latestNotice.title}`)
    //   .setImage("https://cdn.discordapp.com/embed/avatars/0.png")
    .setFooter("Bot maintained by Aabhusan Aryal")
    .setTimestamp();

  resultNew.forEach((candidate) => {
    embed.addField(candidate.candidateName, candidate.candidateVote);
  });
  hooks.forEach((hook) => {
    hook.send(embed);
  });
}
