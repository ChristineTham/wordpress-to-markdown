import fetch from 'node-fetch'
import prettier from 'prettier'

import xml2js from 'xml2js'
import fs from 'fs'
import slugify from 'slugify'
import {
    cleanupShortcodes,
    fixCodeBlocks,
    codeBlockDebugger,
    fixBadHTML,
    fixEmbeds,
} from './articleCleanup.js'

import unified from 'unified'
import parseHTML from 'rehype-parse'
import rehypeRemoveComment from 'rehype-remove-comments'
import rehype2remark from 'rehype-remark'
import stringify from 'remark-stringify'

function toISOLocal(d) {
    const z = n => ('0' + n).slice(-2);
    let off = d.getTimezoneOffset();
    const sign = off < 0 ? '+' : '-';
    off = Math.abs(off);
    return new Date(d.getTime() - (d.getTimezoneOffset() * 60000)).toISOString().slice(0, -1) + sign + z(off / 60 | 0) + ':' + z(off % 60);
}

let images;

processExport("../visualvoyager.xml");

function processExport(file) {
    const parser = new xml2js.Parser();

    fs.readFile(file, function (err, data) {
        if (err) {
            return console.log("Error: " + err);
        }

        parser.parseString(data, function (err, result) {
            if (err) {
                return console.log("Error parsing xml: " + err);
            }
            console.log("Parsed XML");

            const categories = result.rss.channel[0]['wp:category']

            const posts = result.rss.channel[0].item;
            images = posts.filter((p) => p["wp:post_type"][0] === "attachment");

            fs.mkdir("visualvoyager", { recursive: true }, function () {
                posts
                    .filter((p) => p["wp:post_type"][0] === "post")
                    .forEach(processPost);
                categories.forEach(processCategory);
            });
        });
    });
}

async function processCategory(cat) {
    console.log("Processing Category");

    const title = cat['wp:cat_name']
    const slug = cat['wp:category_nicename']
    const parent = cat['wp:category_parent']
    const description = cat['wp:category_description']
    console.log(`Category: ${title} (${slug})`)
    let directory = 'category';
    let fname = `${slug}.md`;

    fs.mkdirSync(`visualvoyager/${directory}`, { recursive: true })


    let frontmatter = [
        "---",
        `title: '${String(title).replace(/'/g, "''")}'`
    ];


    if (parent) {
        frontmatter.push(`parent: ${parent}`);
    }

    if (description) {
        frontmatter.push(`description: ${description}`);
    }

    frontmatter.push("---");
    frontmatter.push("");

    fs.writeFile(
        `visualvoyager/${directory}/${fname}`,
        frontmatter.join("\n"),
        function (err) { }
    );
}

async function processPost(post) {
    console.log("Processing Post");

    const author = post["dc:creator"];
    console.log("Post author: " + author);
    const postTitle =
        typeof post.title === "string" ? post.title : post.title[0];
    console.log("Post title: " + postTitle);
    const postDate = isFinite(new Date(post.pubDate))
        ? new Date(post.pubDate)
        : new Date(post["wp:post_date"]);
    console.log("Post Date: " + postDate);
    let postData = post["content:encoded"][0];
    console.log("Post length: " + postData.length + " bytes");
    let slug = post["wp:post_name"]
    if (slug == "") {
        slug = slugify(postTitle, {
            remove: /[^\w\s]/g,
        })
            .toLowerCase()
            .replace(/\*/g, "");
    }
    console.log("Post slug: " + slug);
    const status = post["wp:status"]

    const description = post["excerpt:encoded"];
    console.log("Post Description: " + description);
    const thumbnail = post["wp:postmeta"]
        .filter(
            (meta) =>
                meta["wp:meta_key"][0].includes("_thumbnail_id")
        )
        .map((meta) => meta["wp:meta_value"][0]);
    const image = images.filter(image => image["wp:post_id"][0] == thumbnail)[0]

    let directory = 'article';
    let fname = `${slug}.md`;

    const categories = post.category.filter(cat => cat['$'].domain == 'category').map(cat => cat['_'])
    const tags = post.category.filter(cat => cat['$'].domain == 'post_tag').map(tag => tag['_'])
    // console.log(categories)
    if (categories.includes('Photo of the Day')) {
        directory = 'potd'
    }
    
    if (categories.includes('Series')) {
        directory = 'series'
    }
    
    if (categories.includes('Review') || categories.includes('Initial Impression') || categories.includes('Real Life Review')) {
        directory = 'review'
    }

    fs.mkdirSync(`visualvoyager/${directory}`, { recursive: true })

    const markdown = await new Promise((resolve, reject) => {
        unified()
            .use(parseHTML, {
                fragment: true,
                emitParseErrors: true,
                duplicateAttribute: false,
            })
            .use(fixCodeBlocks)
            .use(rehypeRemoveComment)
            .use(fixEmbeds)
            .use(rehype2remark)
            .use(cleanupShortcodes)
            .use(stringify, {
                fences: true,
                listItemIndent: 1,
                gfm: false,
                pedantic: false,
            })
            .process(fixBadHTML(postData), (err, markdown) => {
                if (err) {
                    reject(err);
                } else {
                    let content = markdown.contents;
                    content = content.replace(
                        /(?<=https?:\/\/.*)\\_(?=.*\n)/g,
                        "_"
                    );
                    resolve(prettier.format(content, { parser: "markdown" }));
                }
            });
    });

    try {
        postTitle.replace("\\", "\\\\").replace(/"/g, '\\"');
    } catch (e) {
        console.log("FAILED REPLACE", postTitle);
    }

    let frontmatter;
    try {
        frontmatter = [
            "---",
            `author: ${author}`,
            `title: '${postTitle.replace(/'/g, "''")}'`,
            `date: ${toISOLocal(postDate)}`,
            `description: "${description}"`,
        ];
    } catch (e) {
        console.log("----------- BAD TIME", postTitle, postDate);
        throw e;
    }

    if (image) {
        frontmatter.push(`image: ${image["wp:attachment_url"][0]}`);
    }

    if (status == 'draft') {
        frontmatter.push(`draft: true`);
    }

    if (categories && categories.length > 0) {
        frontmatter.push(`categories:\n  - ${categories.join('\n  - ')}`);
    }

    if (tags && tags.length > 0) {
        frontmatter.push(`tags:\n  - ${tags.join('\n  - ')}`);
    }

    frontmatter.push("---");
    frontmatter.push("");

    fs.writeFile(
        `visualvoyager/${directory}/${fname}`,
        frontmatter.join("\n") + markdown,
        function (err) { }
    );
}

async function downloadFile(url) {
    const response = await fetch(url);
    if (response.status >= 400) {
        throw new Error("Bad response from server");
    } else {
        return response;
    }
}
function getPaddedMonthNumber(month) {
    if (month < 10) return "0" + month;
    else return month;
}

function getPaddedDayNumber(day) {
    if (day < 10) return "0" + day;
    else return day;
}
