Version 1.1.5
Created by SolutionStream for FamilySearch

The Lighthouse Automation App is a GUI-based application running on Electron, whose UI is created with React.js, and uses javascript packages such as Puppeteer, Lighthouse, glob, and p-limit, among others. This application aids in conducting Lighthouse Audits under a variety of different methods, such as accessibility, and streamlines audits to occur automatically and concurrently, in order to accomplish auditing all pages with minimal clicks. This app's flexible and customizable approach allows for conducting as many audits as possible with the minimal required effort, allowing potentially entire websites to be audited in one process.

App features:

This application uses Google Chrome's Puppeteer feature to launch an instance of chrome for the url to a website, either inputted by the user, or streamlined through a series of urls provided by the user. Lighthouse will then use Puppeteer to conduct a Lighthouse Audit, scanning the page for things done correctly/incorrectly, and then write a .json file to the computer to be viewed by the user.

This .json file will contain information pertaining to the user's type of audit conducted, to give feedback on the webpage's features, first by providing a score for the user, and then a list of items within the page that are unideal and therefore require checking by the user.

Each of these .json files are categorized by the way they were generated into one of three folders: Custom Audits, Concurrent Audits, and Old Audits. The Custom Audits folder contains all audits completed individually through the application's 'Test One' feature. The Concurrent Audits folder (labeled as just 'Audits') contains all audits most recently completed by the application's 'Test All' feature. Then, the Old Audits folder contains all concurrent audits that have been pushed to the Old Audits folder by the user, to be compared/contrasted, or viewed at the user's leisure.

The application contains a feature to seamlessly transfer all audits from the Concurrent Audits folder to the Old Audits folder, to allow for customizability.

The application's settings feature is included in the main menu as 'View/Change Files'. Included in this page is the following:

Change Initial URL - this is the base URL that will be used to conduct concurrent audits. All paths within the 'Change Paths' text box will be sequentially used to individually combine with the base URL to conduct concurrent audits.

Change Paths - this is a list of url paths, relative to the base URL, to conduct concurrent audits.

Change Access Key - this is the user's Secret Agent Key, which functions to enable the user to access websites that would otherwise be blocked by firewalls and systems alike within a website's security features. Many websites take measures to prevent bots from skimming their sites, and Puppeteer, combined with Lighthouse, often is recognized as a bot from many websites, making the Secret Agent Key necessary for being able to bypass their security features and access the site. You will need to contact an administrator of the site you're looking to audit in order to get a Secret Agent Key generated specific to your computer's IP address.

Installation instructions:

These will be provided at a later date. Stay tuned for updates on how to implement it yourself.
