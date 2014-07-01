/*jshint -W054 */
(function (exports) {
  'use strict';

  var Rrecur = exports.Rrecur || require('./rrecur').Rrecur
    , RRule
    , moment = require('moment')
    , p
    ;

  function parseOffset(offset) {
    var parts = offset.match(/([-+])(\d{2})(\d{2})/)
      , sign = parseInt(parts[1] + '1', 10)
      , hours = parseInt(parts[2], 10)
      , minutes = parseInt(parts[3], 10) / 60
      ;

    return sign * (hours + minutes);
  }

  function commandifyOffset(offset) {
    var parts = offset.toString().match(/(-)?(\d+)(\.\d+)?/)
      , sign = parts[1] || '+'
      , hours = parseInt(parts[2] || 0, 10)
      , minutes = parseInt(parts[3] || 0, 10) * 60
      ;

    return {
      operation: '-' === sign ? 'subtract' : 'add'
    , hours: hours
    , minutes: minutes
    };
  }

  function diffOffsets(m, server, locale) {
    var diff = parseOffset(locale) - parseOffset(server)
      , directive = commandifyOffset(diff)
      ;

    //console.log(directive);
    m[directive.operation](directive.hours, 'hours');
    m[directive.operation](directive.minutes, 'minutes');

    return m;
  }
 
  function addSubtract(m, rule, method, int) {
    var doubleInt = (rule.interval || 1) * int
      , d = m
      ;

    switch(rule.freq) {
    case 'yearly':
      d[method](doubleInt, 'years');
      break;
    case 'monthly':
      d[method](doubleInt, 'months');
      break;
    case 'weekly':
      d[method](doubleInt, 'weeks');
      break;
    case 'daily':
      d[method](doubleInt, 'days');
      break;
    case 'hourly':
      d[method](doubleInt, 'hours');
      break;
    case 'minutely':
      d[method](doubleInt, 'minutes');
      break;
    case 'secondly':
      d[method](doubleInt, 'seconds');
      break;
    }

    return d.toDate().toISOString();
  }
  function add(m, rule) {
    return addSubtract(m, rule, 'add', 1);
  }

  function subtract(m, rule) {
    return addSubtract(m, rule, 'subtract', 1);
  }

  function getDtStart(m, ruleObj, method) {
    var d = moment(m)
      ;

    return addSubtract(d, ruleObj, method, 2);
  }

  Rrecur.create = Rrecur;

  Rrecur.fromISOStringToLocale = function (iso, locale) {
    var offset = Rrecur.getOffsetFromLocale(locale)
      , str
      ;

    str = moment(new Date(iso)).zone(offset).toString();
    str = str.replace(/GMT-.*$/, 'GMT-0000');
    str = new Date(str).toISOString();
    str = str.replace(/Z$/, offset);

    return str;
  };

  Rrecur.adustByTzid = function (date, tzid) {
    // TODO convert from tzid to whatever moment understands
    // http://www.twinsun.com/tz/tz-link.htm
    // http://www.unicode.org/cldr/charts/latest/supplemental/zone_tzid.html
    throw new Error("Not Implemented", tzid);
  };
  Rrecur.adustByLocale = function (date, locale) {
    return new Date(date.toString().replace(/GMT.*/, locale));
  };
  Rrecur.adustByOffset = function (date, tzoffset) {
    // this is to keep 10am, but change which offset it is in
    // so that UTC will change to the appropriate zone
    tzoffset = tzoffset || '-0000';
    return new Date(date.toString().replace(/GMT.*/, 'GMT' + tzoffset/* + ' (' + abbr + ')'*/));
    /*
    if ('string' === tzoffset) {
      // convert from "-0430" to "-04:30"
      tzoffset = tzoffset.replace(/\d{2}\d{2}/, "$1:$2");
    }
    */
  };
  Rrecur.toDateFromISOString = function (iso, locale) {
    var offset = Rrecur.getOffsetFromLocale(locale)
      ;

    return new Date(iso.replace(/Z/, '') + offset);
  };

  p = Rrecur.prototype;
  // TODO XXX XXX Adjust today to be what it would be in the user's locale
  p.init = function (thing, today, dtstartZoneless, locale) {
  // TODO p.init = function (thing, locale, dtstartZoneless, today) {
    // TODO must be ISO / Zulu time
    var me = this
      , dtstartZulu
      ;

    RRule = RRule || exports.RRule || require('rrule').RRule;
    moment = moment || exports.moment || require('moment');

    if (!thing) {
      return;
    }
    me._firstTime = true;
    // MDT => MST could happen while the server is running... ugh
    me._serverLocale = Rrecur.getLocaleFromGmtString(new Date().toString());
    me._serverOffset = Rrecur.getOffsetFromLocale(me._serverLocale);

    // TODO strictly check incoming formats
    if ('string' === typeof thing) {
      me.__rfcString = thing;
      me.__rruleObj = Rrecur.parse(thing);
    } else {
      me.__rfcString = Rrecur.stringify(thing);
      me.__rruleObj = thing;
    }

    me._rule = {};
    Object.keys(me.__rruleObj).forEach(function (key) {
      if (Array.isArray(me.__rruleObj[key])) {
        me._rule[key] = me.__rruleObj[key].slice(0);
      } else {
        me._rule[key] = me.__rruleObj[key];
      }
    });

    if (me._rule.tzid) {
      throw new Error('TZIDs are not yet implemented');
    }

    if (dtstartZoneless) {
      if (!locale) {
        throw new Error("You must specifiy a locale string (or time string) such as 'GMT-0600 (MDT)'");
      }

      dtstartZulu = new Date(
        Rrecur.fromZonelessDtstartToRrule(dtstartZoneless, locale)
      ).toISOString();

      me._rule.dtstart = dtstartZulu;
      me._rule.locale = locale;

      /*
      console.log('[ZLT]', dtstartZoneless, locale);
      console.log('[??D]', Rrecur.fromZonelessDtstartToRrule(dtstartZoneless, locale));
      console.log('[UTC]', dtstartZulu);
      console.log('[SRV]', Rrecur.fromZonelessDtstartToRrule(dtstartZoneless, me._serverLocale));
      */
    } else if (me._rule.dtstart) {
      dtstartZulu = new Date(me._rule.dtstart).toISOString();
    } else {
      //me._rule.dtstart = new Date().toISOString();
      //console.error("DTSTART was not specified, falling back to '" + me._rule.dtstart + "'" );
      throw new Error("You must specify a start date and locale");
    }

    today = new Date(today).toString();
    //today = (today || new Date()).toString();

    if (!me._rule.locale) {
      me._rule.locale = locale;
    }

    if (!me._rule.locale) {
      me._rule.locale = 'GMT-0000 (UTC)'; //new Date().toString();
      throw new Error('no locale was specified');
    }

    me._rule.locale = Rrecur.getLocaleFromGmtString(me._rule.locale);
    me._rule.offset = Rrecur.getOffsetFromLocale(me._rule.locale);

    Rrecur.dtstartDefaults(
      me._rule.freq
      // dtstartZ
    , Rrecur.toDateFromISOString(dtstartZoneless || dtstartZulu, locale || '-0000')
    , me._rule
    , me._rule.locale
    );

    /*
    if (me._rule.count) {
      delete me._rule.count;
    }
    */

    // create a string in the timezone of the server
    me._locale = me._rule.locale;
    me._offset = me._rule.offset;
    delete me._rule.locale;
    delete me._rule.offset;
   
    //console.log('[LCL]', today);
    me._m = moment(today);
    //console.log('[LCL]', me._m.format());
    me._m = diffOffsets(me._m, me._serverOffset, me._offset);
    //console.log('[<XL]', me._m.format());

    me._rfcString = Rrecur.stringify(me._rule, me._locale);
    // Rrule doesn't support TZID or (my own) LOCALE
    //console.log('[RRL]', me._rfcString);
    me._rrule = RRule.fromString(me._rfcString);
  };
  p.previous = function () {
    var me = this
      , date
      , odate
      ;

    if (!me._rule.dtstart) {
      me._rule.dtstart = getDtStart(me._m, me._rule, 'subtract');
    }

    //subtract(me._m, me._rule);
    date = me._m.toDate();
    odate = me._m.toDate();

    date = me._rrule.before(odate);
    me._m = moment(date);

    if (date && me._firstTime) {
      me._firstTime = false;
    }

    date = me._m.toDate();

    if ('Invalid Date' === date.toString()) {
      me._m = moment(odate);
      return null;
    }

    return Rrecur.toLocaleISOString(date, me._locale);
  };
  p.next = function () {
    var me = this
      , date
      , odate
      , ldate
      ;

    /*
    if (!me._rule.until) {
      me._rule.until = getDtStart(me._m, me._rule, 'add');
    }
    */

    /*
    add(me._m, me._rule);
    //return me._rrule.after(me._m.toDate(), true);
    //*/

    date = me._m.toDate();
    odate = me._m.toDate();

    //console.log('[<XL]', odate);
    me._m = moment(me._rrule.after(date, me._firstTime));

    if (me._firstTime) {
      me._firstTime = false;
    }

    date = me._m.toDate();
    if ('Invalid Date' === date.toString()) {
      me._m = moment(odate);
      return null;
    }
    //console.log('[<XL]', date);

    ldate = Rrecur.toLocaleISOString(date, me._locale);
    //console.log('[>XL]', ldate);

    return ldate;
  };

  exports.Rrecur = Rrecur;
}('undefined' !== typeof exports && exports || new Function('return this')()));
