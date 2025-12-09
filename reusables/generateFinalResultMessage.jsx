import { useState } from "react"

export default function generateFinalResultMessage (rawData) {

    const data = JSON.parse(rawData)
    const rawJSONItemNames = Object.keys(data)

    const trimDescription = (description) => {
        const check = '[Learn more'
        const index = description.indexOf(check)
        if (index === -1) return description
        return description.slice(0, index).trim()
    }

    const trimItems = (itemsArray) => {
        itemsArray.shift()
        itemsArray.pop()
        return itemsArray
    }

    const formatExplanation = (rawString) => rawString.split(/\r?\n/).join('.\n')

    const getItems = (itemsArray) => {
        const results = []
        for (let i = 0; i < itemsArray.length; i++) {
            const parts = itemsArray[i].trim().split("-")
            parts.pop()
            results.push(parts.join(" "))
        }
        return results
    }

    const RenderItemList = (itemObject, initiallyVisible = 1) => {
        const [expanded, setExpanded] = useState(false)
        const result = itemObject['itemObject']
        const visibleItems = expanded ? result : result.slice(0, initiallyVisible)
        return (
            <>
            <ul>
                {visibleItems.map((item, index) => {
                    const itemLocation = item.boundingRect
                    return (
                        <>
                        <h3>Main Item:</h3>
                        <p key={index}><strong>HTML snippet:</strong> {item.snippet}</p>
                        {item.itemCategory === "unknown"
                            ? <p>The level of this Item is in an unknown category. You will need to manually check this element to see if it exists in the skin, template, or page level.</p>
                            : <p>The level of this page element is <strong>{item.itemCategory}</strong>.</p>
                        }
                        <p>The webpage element you're looking for is <strong>{itemLocation.height}</strong> pixels tall and <strong>{itemLocation.width}</strong> pixels wide.</p>
                        <p>On the page, this Item can be found at: <strong>{itemLocation.top}, {itemLocation.left}</strong>.</p>
                        {itemLocation.width > 1000 && <p><strong>This element seems to pertain to the banner of the page, or other elements contained within the HTML's head.</strong></p>}
                        {item.subItems && <h3>Sub Items:</h3>}
                        {item.subItems && item.subItems.map((subItem, index) => (
                            <ul>
                            <p key={index}><strong>HTML Snippet:</strong> {subItem.snippet}</p>
                            <p><strong>Text On Page:</strong> {subItem.nodeLabel}</p>
                            <p>This Sub Item is <strong>{subItem.boundingRect.height}</strong> pixels tall and <strong>{subItem.boundingRect.width}</strong> pixels wide.</p>
                            <p>One the page, this Sub Item can be found at: <strong>{subItem.boundingRect.top}, {subItem.boundingRect.left}</strong>.</p>
                            {index < item.subItems.length - 1 && (
                                <>
                                <br />
                                <hr className="subItemHr" />
                                <br />
                                </>
                            )}
                            </ul>
                        ))}
                        <br />
                        <hr />
                        <br />
                        </>
                    )}
                )}
            </ul>

            {result.length > initiallyVisible && (
                <button onClick={() => setExpanded(prev => !prev)} className="results-btn">
                    {expanded ? "Show Less ▲" : "Show More ►"}
                </button>
            )}
            </>
        )
    }

    const items = getItems(trimItems(rawJSONItemNames))
    let ordinal = (i) => i === 0 ? 'first' : 'next'
    let scoreMessage = `Your audit generated an Accessibility Score of ${data.accessibilityScore}.`

    return (
        <>
        <h2>{scoreMessage}</h2>
        <p>You have {Object.keys(data).length - 2} items to attend to with this page. Let's break this down:</p>
        <br />
        {rawJSONItemNames.map((itemName, index) => (
            <>
            <h3>Your {ordinal(index)} item concerns {items[index]}:</h3>
            <p>{data[itemName].title}.</p>
            <p>{trimDescription(data[itemName].description)}</p>
            <p><strong>The solution:</strong> {formatExplanation(data[itemName].items[0].explanation)}</p>
            <RenderItemList itemObject={data[itemName].items} />
            <br />
            </>
        ))}
        <h3>That's all the issues for now.</h3>
        <button className="btn btn-main" onClick={() => window.scrollTo({ top: 0, left: 0, behavior: 'smooth'})}>Back To Top ▲</button>
        <div className="page-spacer"></div>
        </>
    )
}