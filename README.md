Version 0.9.3
Created by Jarod Day

This is a GUI-based desktop application designed to accomplish the tasks of the Lighthouse Automation Command Line Application, <a href="https://github.com/groovyjarod/lighthouse-automation/">which can be found here</a>. A chrome extension exists alongside this app to visualize accessibility audits and where they were generated, which can be found <a href="https://github.com/groovyjarod/Audit-Extension">here</a>. It is recommended to use this extension tool alongside this app in order to get the most out of Google's Lighthouse Auditing feature. 

To get a full synopsis of the logic being performed in this application, <a href="https://github.com/groovyjarod/lighthouse-automation/blob/main/README.md">read the Lighthouse Automation Readme here</a>.

A brief overview of the features of this app:

This app is designed to comprehensively and simply generate lighthouse automation reports in a GUI-based fashion, making the process of generating lighthouse reports doable for people of all backgrounds of technology. Reports are categorized in a customizable way that enables the user to easily and readily locate files and use them in other applications, such as the <a href="https://github.com/groovyjarod/Audit-Extension>audit extension tool</a>.

Mass-auditing webpages:
 A central feature of this app is the ability to automate a large number of audits at a concurrency of the user's choice, for a website of many pages. This app will determine the number of recommended simultaneous audits based on the user's computer's capabilities, and the user will choose how many. A series of audits will then conduct based on the initial URL given by the user and a .txt file that can be uploaded, which will be looped through to visit each of the website's paths provided by the .txt file.
 All audits are stored in an organized folder, which can be used to view, cross-reference other audits, and gain insights into each page's problems.
