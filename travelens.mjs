import { format } from 'date-fns'
import fetch from 'node-fetch'
import path from 'path'
import prettier from 'prettier'

import xml2js from 'xml2js'
import fs from 'fs'
import slugify from 'slugify'
import htmlentities from 'he'
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
import imageType from 'image-type'

function toISOLocal(d) {
    const z = n => ('0' + n).slice(-2);
    let off = d.getTimezoneOffset();
    const sign = off < 0 ? '+' : '-';
    off = Math.abs(off);
    return new Date(d.getTime() - (d.getTimezoneOffset() * 60000)).toISOString().slice(0, -1) + sign + z(off / 60 | 0) + ':' + z(off % 60);
}

let images;

// includes all sorts of edge cases and weird stuff
processExport("travelsthroughalens.xml");
// full dump
// processExport("ageekwithahat.wordpress.2020-08-22 (1).xml");

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

            const posts = result.rss.channel[0].item;
            images = posts.filter((p) => p["wp:post_type"][0] === "attachment");

            fs.mkdir("travelens", { recursive: true }, function () {
                posts
                    .filter((p) => p["wp:post_type"][0] === "post")
                    .forEach(processPost);
            });
        });
    });
}

function constructImageName({ urlParts, buffer }) {
    const pathParts = path.parse(
        urlParts.pathname
            .replace(/^\//, "")
            .replace(/\//g, "-")
            .replace(/\*/g, "")
    );
    const { ext } = imageType(new Buffer(buffer));

    return `${pathParts.name}.${ext}`;
}

async function processImage({ url, postData, images, directory }) {
    const cleanUrl = htmlentities.decode(url);

    if (cleanUrl.startsWith("./img")) {
        console.log(`Already processed ${cleanUrl} in ${directory}`);

        return [postData, images];
    }

    const urlParts = new URL(cleanUrl);

    const filePath = `out/${directory}/img`;

    try {
        const response = await downloadFile(cleanUrl);
        const type = response.headers.get("Content-Type");

        if (type.includes("image") || type.includes("octet-stream")) {
            const buffer = await response.arrayBuffer();
            const imageName = constructImageName({
                urlParts,
                buffer,
            });

            //Make the image name local relative in the markdown
            postData = postData.replace(url, `./img/${imageName}`);
            images = [...images, `./img/${imageName}`];

            fs.writeFileSync(`${filePath}/${imageName}`, new Buffer(buffer));
        }
    } catch (e) {
        console.log(`Keeping ref to ${url}`);
    }

    return [postData, images];
}

async function processImages({ postData, directory }) {
    const patt = new RegExp('(?:src="(.*?)")', "gi");
    let images = [];

    var m;
    let matches = [];

    while ((m = patt.exec(postData)) !== null) {
        if (!m[1].endsWith(".js")) {
            matches.push(m[1]);
        }
    }

    if (matches != null && matches.length > 0) {
        for (let match of matches) {
            try {
                [postData, images] = await processImage({
                    url: match,
                    postData,
                    images,
                    directory,
                });
            } catch (err) {
                console.log("ERROR PROCESSING IMAGE", match);
            }
        }
    }

    return [postData, images];
}

async function processPost(post) {
    console.log("Processing Post");

    const postTitle =
        typeof post.title === "string" ? post.title : post.title[0];
    console.log("Post title: " + postTitle);
    const postDate = isFinite(new Date(post.pubDate))
        ? new Date(post.pubDate)
        : new Date(post["wp:post_date"]);
    console.log("Post Date: " + postDate);
    let postData = post["content:encoded"][0];
    console.log("Post length: " + postData.length + " bytes");
    const slug = post["wp:post_name"]
    // const slug = slugify(postTitle, {
    //     remove: /[^\w\s]/g,
    // })
    //     .toLowerCase()
    //     .replace(/\*/g, "");
    console.log("Post slug: " + slug);

    // takes the longest description candidate
    // const description = [
    //     post.description,
    //     ...post["wp:postmeta"].filter(
    //         (meta) =>
    //             meta["wp:meta_key"][0].includes("metadesc") ||
    //             meta["wp:meta_key"][0].includes("description")
    //     ),
    // ].sort((a, b) => b.length - a.length)[0];
    const description = post["excerpt:encoded"];
    console.log("Post Description: " + description);
    const thumbnail = post["wp:postmeta"]
        .filter(
            (meta) =>
                meta["wp:meta_key"][0].includes("_thumbnail_id")
        )
        .map((meta) => meta["wp:meta_value"][0]);
    const image = images.filter(image => image["wp:post_id"][0] == thumbnail)[0]
    console.log(image["wp:attachment_url"][0]);
    const heroURLs = post["wp:postmeta"]
        .filter(
            (meta) =>
                meta["wp:meta_key"][0].includes("opengraph-image") ||
                meta["wp:meta_key"][0].includes("twitter-image")
        )
        .map((meta) => meta["wp:meta_value"][0])
        .filter((url) => url.startsWith("http"));

    let heroImage = "";

    // let directory = 'post';
    let fname = `${slug}.md`;

    // try {
    //     fs.mkdirSync(`out/${directory}`);
    //     fs.mkdirSync(`out/${directory}/img`);
    // } catch (e) {
    //     directory = directory + "-2";
    //     fs.mkdirSync(`out/${directory}`);
    //     fs.mkdirSync(`out/${directory}/img`);
    // }
    const directory = post.category.filter(cat => cat['$'].domain == 'category')[0]['$'].nicename
    fs.mkdirSync(`travelens/${directory}`, { recursive: true })
    const trip = post.category.filter(cat => cat['$'].domain == 'category')[0]['_']
    const tags = post.category.filter(cat => cat['$'].domain == 'post_tag').map(tag => tag['_'])

    // //Find all images
    // let images = [];
    // if (heroURLs.length > 0) {
    //     const url = heroURLs[0];
    //     [postData, images] = await processImage({
    //         url,
    //         postData,
    //         images,
    //         directory,
    //     });
    // }

    // [postData, images] = await processImages({ postData, directory });

    // heroImage = images.find((img) => !img.endsWith("gif"));

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

    // const redirect_from = post.link[0]
    //     .replace("https://swizec.com", "")
    //     .replace("https://www.swizec.com", "");
    let frontmatter;
    try {
        frontmatter = [
            "---",
            `title: '${postTitle.replace(/'/g, "''")}'`,
            `date: ${toISOLocal(postDate)}`,
            `description: "${description}"`,
            `trip: ${trip}`,
            `place: Australia`,
            `timezone: Australia/Sydney`,
            `location: Somewhere`,
            `image: ${image["wp:attachment_url"][0]}`,
            `gallery: gallery`,
            `map: [0, 1, 2]`,
        ];
    } catch (e) {
        console.log("----------- BAD TIME", postTitle, postDate);
        throw e;
    }

    if (tags && tags.length > 0) {
        frontmatter.push(`tags:\n  - ${tags.join('\n  - ')}`);
    }

    // frontmatter.push(`hero: ${heroImage || "../../../defaultHero.jpg"}`);
    frontmatter.push("---");
    frontmatter.push("");

    fs.writeFile(
        `travelens/${directory}/${fname}`,
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
