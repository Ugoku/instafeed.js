let Instafeed = class Instafeed {
    constructor(params, context) {
        var option, value;
        // default options
        this.options = {
            target: 'instafeed',
            get: 'popular',
            resolution: 'thumbnail',
            sortBy: 'none',
            links: true,
            mock: false,
        };
        // if an object is passed in, override the default options
        if (typeof params === 'object') {
            for (option in params) {
                value = params[option];
                this.options[option] = value;
            }
        }
        // save a reference to context, which defaults to curr scope
        // this will be used to cache data from parsing to the real
        // instance the user interacts with (for pagination)
        this.context = context != null ? context : this;
        // generate a unique key for the instance
        this.unique = this._genKey();
    }

    // method to check if there are more results to load
    hasNext() {
        return typeof this.context.nextUrl === 'string' && this.context.nextUrl.length > 0;
    }

    // method to display next results using the pagination
    // data from API. Manually passing a url to .run() will
    // bypass the URL creation from options.
    next() {
        if (!this.hasNext()) {
            // check for a valid next url first
            return false;
        }
        // call run with the next results
        return this.run(this.context.nextUrl);
    }

    // MAKE IT GO!
    run(url) {
        var header, instanceName, script;
        // make sure either a client id or access token is set
        if (typeof this.options.clientId !== 'string') {
            if (typeof this.options.accessToken !== 'string') {
                throw new Error("Missing clientId or accessToken.");
            }
        }
        if (typeof this.options.accessToken !== 'string') {
            if (typeof this.options.clientId !== 'string') {
                throw new Error("Missing clientId or accessToken.");
            }
        }
        // run the before() callback, if one is set
        if ((this.options.before != null) && typeof this.options.before === 'function') {
            this.options.before.call(this);
        }
        // to make it easier to test various parts of the class,
        // any DOM manipulation first checks for the DOM to exist
        if (typeof document !== "undefined" && document !== null) {
            // make a new script element
            script = document.createElement('script');
            // give the script an id so it can removed later
            script.id = 'instafeed-fetcher';
            // assign the script src using _buildUrl(), or by
            // using the argument passed to the function
            script.src = url || this._buildUrl();
            // add the new script object to the header
            header = document.getElementsByTagName('head');
            header[0].appendChild(script);
            // create a global object to cache the options
            instanceName = `instafeedCache${this.unique}`;
            window[instanceName] = new Instafeed(this.options, this);
            window[instanceName].unique = this.unique;
        }
        // return true if everything ran
        return true;
    }

    // Data parser (must be a json object)
    parse(response) {
        var anchor, childNodeCount, childNodeIndex, childNodesArr, e, eMsg, fragment, header, htmlString, i, image, imageObj, imageString, images, img, imgHeight, imgOrient, imgUrl, imgWidth, instanceName, j, k, len, len1, len2, node, parsedLimit, reverse, sortSettings, targetEl, tmpEl;
        let imageUrl = '';
        let imageSrcSet = [];
        // throw an error if not an object
        if (typeof response !== 'object') {
            // either throw an error or call the error callback
            if ((this.options.error != null) && typeof this.options.error === 'function') {
                this.options.error.call(this, 'Invalid JSON data');
                return false;
            } else {
                throw new Error('Invalid JSON response');
            }
        }
        // check if the api returned an error code
        if (response.meta.code !== 200) {
            // either throw an error or call the error callback
            if ((this.options.error != null) && typeof this.options.error === 'function') {
                this.options.error.call(this, response.meta.error_message);
                return false;
            } else {
                throw new Error(`Error from Instagram: ${response.meta.error_message}`);
            }
        }
        // check if the returned data is empty
        if (response.data.length === 0) {
            // either throw an error or call the error callback
            if ((this.options.error != null) && typeof this.options.error === 'function') {
                this.options.error.call(this, 'No images were returned from Instagram');
                return false;
            } else {
                throw new Error('No images were returned from Instagram');
            }
        }
        // call the success callback if no errors in response
        if ((this.options.success != null) && typeof this.options.success === 'function') {
            this.options.success.call(this, response);
        }
        // cache the pagination data, if it exists. Apply the value
        // to the "context" object, which will be a true reference
        // if this instance was created just for parsing
        this.context.nextUrl = '';
        if (response.pagination != null) {
            this.context.nextUrl = response.pagination.next_url;
        }
        // before images are inserted into the DOM, check for sorting
        if (this.options.sortBy !== 'none') {
            // if sort is set to random, don't check for polarity
            if (this.options.sortBy === 'random') {
                sortSettings = ['', 'random'];
            } else {
                // get the sort settings from @options
                sortSettings = this.options.sortBy.split('-');
            }
            // determine if the order should be inverse
            reverse = sortSettings[0] === 'least' ? true : false;
            // handle the case for sorting
            switch (sortSettings[1]) {
                case 'random':
                    response.data.sort(function() {
                        return 0.5 - Math.random();
                    });
                    break;
                case 'recent':
                    response.data = this._sortBy(response.data, 'created_time', reverse);
                    break;
                case 'liked':
                    response.data = this._sortBy(response.data, 'likes.count', reverse);
                    break;
                case 'commented':
                    response.data = this._sortBy(response.data, 'comments.count', reverse);
                    break;
                default:
                    throw new Error(`Invalid option for sortBy: '${this.options.sortBy}'.`);
            }
        }
        // to make it easier to test various parts of the class,
        // any DOM manipulation first checks for the DOM to exist
        if ((typeof document !== "undefined" && document !== null) && this.options.mock === false) {
            // limit the number of images if needed
            images = response.data;
            parsedLimit = parseInt(this.options.limit, 10);
            if ((this.options.limit != null) && images.length > parsedLimit) {
                images = images.slice(0, parsedLimit);
            }
            // create the document fragment
            fragment = document.createDocumentFragment();
            // filter the results
            if ((this.options.filter != null) && typeof this.options.filter === 'function') {
                images = this._filter(images, this.options.filter);
            }
            // determine whether to parse a template, or use html fragments
            if ((this.options.template != null) && typeof this.options.template === 'string') {
                // create an html string
                htmlString = '';
                imageString = '';
                // create a temp dom node that will hold the html
                tmpEl = document.createElement('div');
                // loop through the images
                for (i = 0, len = images.length; i < len; i++) {
                    image = images[i];
                    imageObj = image.images[this.options.resolution];
                    imageSrcSet = [];
                    Object.keys(image.images).forEach(function(key) {
                        let imgObj = image.images[key];
                        imageSrcSet.push(imgObj.url + ' ' + imgObj.width + 'w');
                    });

                    if (typeof imageObj !== 'object') {
                        eMsg = `No image found for resolution: ${this.options.resolution}.`;
                        throw new Error(eMsg);
                    }
                    imgWidth = imageObj.width;
                    imgHeight = imageObj.height;
                    imgOrient = "square";
                    if (imgWidth > imgHeight) {
                        imgOrient = "landscape";
                    }
                    if (imgWidth < imgHeight) {
                        imgOrient = "portrait";
                    }
                    // use protocol relative image url
                    imageUrl = imageObj.url;
                    // parse the template
                    imageString = this._makeTemplate(this.options.template, {
                        model: image,
                        id: image.id,
                        link: image.link,
                        type: image.type,
                        image: imageUrl,
                        srcset: imageSrcSet.join(', '),
                        width: imgWidth,
                        height: imgHeight,
                        orientation: imgOrient,
                        caption: this._getObjectProperty(image, 'caption.text'),
                        likes: image.likes.count,
                        comments: image.comments.count,
                        location: this._getObjectProperty(image, 'location.name')
                    });
                    // add the image partial to the html string
                    htmlString += imageString;
                }
                // add the final html string to the temp node
                tmpEl.innerHTML = htmlString;
                // loop through the contents of the temp node
                // and append them to the fragment
                childNodesArr = [];
                childNodeIndex = 0;
                childNodeCount = tmpEl.childNodes.length;
                while (childNodeIndex < childNodeCount) {
                    childNodesArr.push(tmpEl.childNodes[childNodeIndex]);
                    childNodeIndex += 1;
                }
                for (j = 0, len1 = childNodesArr.length; j < len1; j++) {
                    node = childNodesArr[j];
                    fragment.appendChild(node);
                }
            } else {
                // loop through the images
                for (k = 0, len2 = images.length; k < len2; k++) {
                    image = images[k];
                    // create the image using the @options's resolution
                    img = document.createElement('img');
                    // use protocol relative image url
                    imageObj = image.images[this.options.resolution];
                    if (typeof imageObj !== 'object') {
                        eMsg = `No image found for resolution: ${this.options.resolution}.`;
                        throw new Error(eMsg);
                    }
                    // use protocol relative image url
                    imageUrl = imageObj.url;
                    img.src = imageUrl;
                    // wrap the image in an anchor tag, unless turned off
                    if (this.options.links === true) {
                        // create an anchor link
                        anchor = document.createElement('a');
                        anchor.href = image.link;
                        // add the image to it
                        anchor.appendChild(img);
                        // add the anchor to the fragment
                        fragment.appendChild(anchor);
                    } else {
                        // add the image (without link) to the fragment
                        fragment.appendChild(img);
                    }
                }
            }
            // add the fragment to the dom:
            // - if target is string, consider it as element id
            // - otherwise consider it as element
            targetEl = this.options.target;
            if (typeof targetEl === 'string') {
                targetEl = document.getElementById(targetEl);
            }
            if (targetEl == null) {
                eMsg = `No element with id="${this.options.target}" on page.`;
                throw new Error(eMsg);
            }
            targetEl.appendChild(fragment);
            // remove the injected script tag
            header = document.getElementsByTagName('head')[0];
            header.removeChild(document.getElementById('instafeed-fetcher'));
            // delete the cached instance of the class
            instanceName = `instafeedCache${this.unique}`;
            window[instanceName] = void 0;
            try {
                delete window[instanceName];
            } catch (error) {
                e = error;
            }
        }
        // END if document?

        // run after callback function, if one is set
        if ((this.options.after != null) && typeof this.options.after === 'function') {
            this.options.after.call(this);
        }
        // return true if everything ran
        return true;
    }

    // helper function that structures a url for the run()
    // function to inject into the document hearder
    _buildUrl() {
        var base, endpoint, final;
        // set the base API URL
        base = "https://api.instagram.com/v1";
        // get the endpoint based on @options.get
        switch (this.options.get) {
            case "popular":
                endpoint = "media/popular";
                break;
            case "tagged":
                // make sure a tag is defined
                if (!this.options.tagName) {
                    throw new Error("No tag name specified. Use the 'tagName' option.");
                }
                // set the endpoint
                endpoint = `tags/${this.options.tagName}/media/recent`;
                break;
            case "location":
                // make sure a location id is defined
                if (!this.options.locationId) {
                    throw new Error("No location specified. Use the 'locationId' option.");
                }
                // set the endpoint
                endpoint = `locations/${this.options.locationId}/media/recent`;
                break;
            case "user":
                // make sure there is a user id set
                if (!this.options.userId) {
                    throw new Error("No user specified. Use the 'userId' option.");
                }
                endpoint = `users/${this.options.userId}/media/recent`;
                break;
            default:
                // throw an error if any other option is given
                throw new Error(`Invalid option for get: '${this.options.get}'.`);
        }
        // build the final url (uses the instance name)
        final = `${base}/${endpoint}`;
        // use the access token for auth when it's available
        // otherwise fall back to the client id
        if (this.options.accessToken != null) {
            final += `?access_token=${this.options.accessToken}`;
        } else {
            final += `?client_id=${this.options.clientId}`;
        }
        // add the count limit
        if (this.options.limit != null) {
            final += `&count=${this.options.limit}`;
        }
        // add the jsonp callback
        final += `&callback=instafeedCache${this.unique}.parse`;
        // return the final url
        return final;
    }

    // helper function to generate a unique key
    _genKey() {
        let s4 = function() {
            return (((1 + Math.random()) * 0x10000) | 0).toString(16).substring(1);
        };
        return `${s4()}${s4()}${s4()}${s4()}`;
    }

    // helper function to parse a template
    _makeTemplate(template, data) {
        var output, pattern, ref, varName, varValue;
        // regex pattern
        pattern = /(?:\{{2})([\w\[\]\.]+)(?:\}{2})/; // opening braces
        // variable name
        // closing braces
        // copy the template
        output = template;
        // process the template (null defaults to empty strings)
        while (pattern.test(output)) {
            varName = output.match(pattern)[1];
            varValue = (ref = this._getObjectProperty(data, varName)) != null ? ref : '';
            output = output.replace(pattern, function() {
                return `${varValue}`;
            });
        }
        // send back the new string
        return output;
    }

    // helper function to access an object property by string
    _getObjectProperty(object, property) {
        var piece, pieces;
        // convert [] to dot-syntax
        property = property.replace(/\[(\w+)\]/g, '.$1');
        // split the object into arrays
        pieces = property.split('.');
        // run through the array to find the
        // nested property
        while (pieces.length) {
            // move down the property chain
            piece = pieces.shift();
            // if they key exists, copy the value
            // into 'object', otherwise return null
            if ((object != null) && piece in object) {
                object = object[piece];
            } else {
                return null;
            }
        }
        // send back the final object
        return object;
    }

    // helper function to sort an array objects by an
    // object property (sorts highest to lowest)
    _sortBy(data, property, reverse) {
        var sorter;
        // comparator function
        sorter = function(a, b) {
            var valueA, valueB;
            valueA = this._getObjectProperty(a, property);
            valueB = this._getObjectProperty(b, property);
            // sort lowest-to-highest if reverse is true
            if (reverse) {
                if (valueA > valueB) {
                    return 1;
                } else {
                    return -1;
                }
            }
            // otherwise sort highest to lowest
            if (valueA < valueB) {
                return 1;
            } else {
                return -1;
            }
        };
        // sort the data
        data.sort(sorter.bind(this));
        return data;
    }

    // helper method to filter out images
    _filter(images, filter) {
        var filteredImages, fn, i, image, len;
        filteredImages = [];
        fn = function(image) {
            if (filter(image)) {
                return filteredImages.push(image);
            }
        };
        for (i = 0, len = images.length; i < len; i++) {
            image = images[i];
            fn(image);
        }
        return filteredImages;
    }
};

(function(root, factory) {
    // set up exports
    if (typeof define === 'function' && define.amd) {
        return define([], factory);
    } else if (typeof module === 'object' && module.exports) {
        return module.exports = factory();
    } else {
        return root.Instafeed = factory();
    }
})(this, function() {
    return Instafeed;
});
