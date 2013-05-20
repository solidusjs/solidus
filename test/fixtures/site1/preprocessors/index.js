context.test = true;
context.moment_test = moment('Dec 25, 1995').format();
context.xdate_test = new XDate('Dec 25, 1995').toString();
context.underscore_test = _({ test: 'test' }).keys();
context.sugar_test = 'te'.add( 'st', 2 );