# wordpress-to-markdownkmarkdown)

This script uses the standard exported XML file from WordPress, and creates a folder/file structure that contains all of the blog posts, converted to markdown format. It will also download all of the images.

Instructions for exporting your information from WordPress [can be found here](http://en.support.wordpress.com/export/).

This is a upgraded version of the original project. I fixed the issue with `<pre><code>` blocks. Remove some unnecessary dependencies. Add more documentation support.
Also, I fixed the folder structure. Originally, the folder is Windows only, now it should support both Windows/Mac/Linux out of the box.
### Works on my box

**This is highly experimental at best. It was developed for my own use to do a one time conversion from WordPress to markdown for a static generator such as [DocPad](https://github.com/bevry/docpad). It is designed to be used one time and then throw away.**

### Usage
This program will put the output into `/out` folder, and also all images will go to `/img`. One thing we need to be aware is that
the default image public path has been changed to `/img`


1. To use, please put your exported Wordpress XML into `export.xml`.
2. Install all the necessary dependencies via `npm install`
3. To run, simply type `node convert.js`.
### Technical Details

This uses [xml2js](https://github.com/Leonidas-from-XIV/node-xml2js) to parse the XML easily, and then uses [to-markdown](https://github.com/domchristie/to-markdown) to convert the HTML post content into Markdown. (Note, we use the modified source here to
output github flavored markdown)

### Requirements

* You must have Node.js installed and available in the folder you wish to run the script from.
* The folder the script is is *must* contain a WordPress export file called "export.xml". The file name is hard-coded.

### License

The MIT License (MIT)

Copyright (c) 2013 Jason Young

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

