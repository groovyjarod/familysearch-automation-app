import lighthouse from "lighthouse";
import puppeteer from "puppeteer";
import { writeFile } from "fs/promises";

export default async function LighthouseTest () {
    const browser = await puppeteer.launch({ headless: false })
    const page = await browser.newPage()
    const port = new URL(browser.wsEndpoint()).port

    const options = {
        logLevel: 'info',
        output: 'json',
        onlyCategories: ['accessibility'],
        port,
    }

    const runnerResults = await lighthouse('https://example.com/', options, { page })
    console.log(JSON.stringify(runnerResults.lhr, null, 2))
}