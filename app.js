var mysql = require("mysql");
var StellarSdk = require('stellar-sdk');

// only presently setup for testnet we will add Live switch from OpenCart configs later
var pub = "Public Global Stellar Network ; September 2015";
var tes = "Test SDF Network ; September 2015";
 //PUBLIC: "Public Global Stellar Network ; September 2015"
 //TESTNET: "Test SDF Network ; September 2015"        
var server = new StellarSdk.Server({     
          hostname: "horizon-testnet.stellar.org",
          port: 443,
          protocol: "https",
        });

StellarSdk.Network.use(new StellarSdk.Network(tes));

var con = mysql.createConnection({
  host: "localhost",
  user: "username",
  password: "password",
  database: "opencart"
});

con.connect(function(err){
  if(err){
    console.log('Error connecting to Db');
    return;
  }
  console.log('Connection established');
});

var specs = {};
specs.maxTime = "0";

// this is used if no escrow_vendor_signer_secret provided by OpenCart stellar plugin
// may use this for testing or if you feel more secure having signer key here instead of OC server admin access
specs.escrow_vendor_signer_secret = "SDXV...";
//specs.escrow_signer_keypair = StellarSdk.Keypair.fromSecret(specs.escrow_vendor_signer_secret).publicKey();
specs.escrow_signer_publicId = StellarSdk.Keypair.fromSecret(specs.escrow_vendor_signer_secret).publicKey();

// specs object includes:

         // specs.destination // the store payment address 
         // specs.asset_code  // what is accepted by the store
         // specs.asset_issuer
         // specs.amount
         // specs.memo  // this becomes the stores order_id number in a text memo
         // specs.minTime  // timestamp that is also called expire_ts
         // specs.maxTime  // just set to zero in this case
         // specs.escrow_publicId
         // specs.escrow_publicId
         // specs.escrow_service_publicId
           // values bellow not used in this function but use in check_escrow_holding_account
         // specs.signer_weight : weights settings on all low,med,high signer weights (normally 2)
         // specs.signer_count : total number of signers on this account (normally 3)

  function get_stellar_net_settings(callback){
    console.log("start get_stellar_net_settings");
    specs.signer_weight = 2;
    specs.signer_count = 3;

    con.query('SELECT * FROM oc_setting WHERE code = "stellar_net"',function(err,rows){
      if(err) throw err;

      //console.log('Data received from Db 3:\n');
      //console.log(rows);
      for (var i = 0; i < rows.length; i++) {
        //console.log(rows[i].order_id);
        //console.log(rows[i]);
        //console.log(rows[i].key);
        //console.log(rows[i].value);
        if (rows[i].key == "stellar_net_asset_code"){
          //console.log("got asset_code");
          specs.asset_code = rows[i].value;
        }
        if (rows[i].key == "stellar_net_issuer"){
          specs.asset_issuer = rows[i].value; 
        }
        if (rows[i].key == "stellar_net_escrows_publicId"){
          specs.escrow_service_publicId = rows[i].value; 
        }
        if (rows[i].key == "stellar_net_publicid"){
          specs.destination = rows[i].value; 
        }        
        if (rows[i].key == "stellar_net_escrow_expire_hours"){
          specs.escrow_hours = rows[i].value; 
        }
        if (rows[i].key == "stellar_net_testnet_mode"){
          specs.testnet_mode = rows[i].value; 
        }
        if (rows[i].key == "stellar_net_escrow_vendor_signer_secret"){
          if (rows[i].value.length == 56){
            specs.escrow_vendor_signer_secret = rows[i].value;
            specs.escrow_signer_publicId = StellarSdk.Keypair.fromSecret(specs.escrow_vendor_signer_secret).publicKey();         
          }          
        }             
      }
      callback();     
    });    
  }

  var ccbuild = ccbuild || {};
     ccbuild.CallChain = function () {
       var cs = [];
       this.add = function (call) {
         cs.push(call);
       };
       this.execute = function () {
         var wrap = function (call, callback) {
            return function () {
                call(callback);
            };
         };
         for (var i = cs.length-1; i > -1; i--) {
            cs[i] = 
                wrap(
                    cs[i], 
                    i < cs.length - 1 
                        ? cs[i + 1] 
                        : null);
         }
         cs[0]();
       };
     };

     
     function check_result(callback){
       console.log("check_result specs:");
       console.log(specs);
       callback();
     }

     function noop(callback){
       // performs almost no action to signal end callback chain without error (no callback done)
       console.log("started noop");
       close_db();       
     }

     function start(){
       console.log("start");
       var cc = new ccbuild.CallChain();
       cc.add(get_stellar_net_settings);
       cc.add(get_stellar_net_orders);     
       cc.add(noop);
       cc.execute();
     }


  function check_escrow_holding_account(specs_local){
    console.log("start check_escrow_holding_account");
    // this verifies the escrow holding account has these specs:
    // specs_local.destination // the stores payment address, should be signer on this account with weight 1
    // specs_local.asset_code  // what is accepted by the store so must have trustline for this
    // specs_local.asset_issuer // must have trustline with this and asset_code above
    // specs_local.amount // must contain this amount of the asset above
    // specs_local.memo  // not used in this function
    // specs_local.minTime  // not used in this function
    // specs_local.maxTime  // not used in this function
    // specs_local.escrow_publicId :  this is the account we are checking that should also have signing weight of 1
    // specs_local.escrow_service_publicId : must be a signer in this account with weight 1
    // specs_local.signer_weight : weights settings on all low,med,high signer weights (normally 2)
    // specs_local.signer_count : total number of signers on this account (normally 3)
    // specs_local.escrow_hours : number of hours after order was made to when it must expire (with some tolerance or about 100 sec)

    // added returned values of specs when this function completes:
    // specs_local.account_ok : true or false
    // specs_local.account_signers_ok : true or false
    // specs_local.account_info ; value returned from horizon for escrow_publicId account
    // specs_local.account_err ; detailed values returned if horizon or others returns error
    
    console.log("specs");
    console.log(specs);
    specs_local.account_ok = true;
    server.accounts()
          .accountId(specs_local.escrow_publicId)          
          .call()
          .then(function (accountResult) { 
            //console.log("account info results");          
            //console.log(accountResult.signers);
            specs_local.account_info = accountResult;
          //{ low_threshold: 2, med_threshold: 2, high_threshold: 2 }
            if (accountResult.account_id != specs_local.escrow_publicId){
              console.log("account_id wrong");
              specs_local.account_ok = false;
            }
            if (accountResult.balances[0].asset_code != specs_local.asset_code){
              console.log("asset_code wrong");
              specs_local.account_ok = false;
            }
            if (accountResult.balances[0].asset_issuer != specs_local.asset_issuer){
              console.log("asset_issuer wrong:");
              specs_local.account_ok = false;
            }
            if (accountResult.thresholds.low_threshold != specs_local.signer_weight){
              console.log("weight theshold set wrong");
              specs_local.account_ok = false;
            }
            if (accountResult.thresholds.med_threshold != specs_local.signer_weight){
              console.log("weight theshold set wrong");
              specs_local.account_ok = false;
            }
            if (accountResult.thresholds.high_threshold != specs_local.signer_weight){
              console.log("weight theshold set wrong");
              specs_local.account_ok = false;
            }            
            if (accountResult.signers.length != specs_local.signer_count){
              console.log("signer_count wrong at: ",accountResult.signers.length)
              specs_local.account_ok = false;
            }

            var signers_ok = true;
            for (var i = 0; i < accountResult.signers.length; i++) { 
              console.log(accountResult.signers[i]);
              console.log(accountResult.signers[i].key);
              if (accountResult.signers[i].weight != 1){
                console.log("Error: weight not 1 for signer at: ",i);
                signers_ok = false;
              }
              if (accountResult.signers[i].key != specs_local.escrow_service_publicId && accountResult.signers[i].key != specs_local.escrow_publicId && accountResult.signers[i].key != specs_local.destination){
                console.log("Error: no signer match at: ", i);
                signers_ok = false;
              }
            }
            // escrow_account_status: 0 untested, 1 escrow account ok, 2 specs fail, 3 signers fail, 4 get error in get_account_info        
            specs_local.account_signers_ok = signers_ok;
            if (signers_ok != true){
              update_stellar_net_escrow_account_status(specs_local.order_id,3);
              // status 10 on order_status = fail
              update_order_status_id(specs_local.order_id,10);
              //specs_local.account_ok = false;
            }
            if (specs_local.account_ok == false){
              update_stellar_net_escrow_account_status(specs_local.order_id,2);
              // status 10 on order_status = fail
              update_order_status_id(specs_local.order_id,10);
            }
            if (specs_local.account_ok == true && signers_ok == true){
              update_stellar_net_escrow_account_status(specs_local.order_id,1);
            }
            console.log(specs);             
          })
          .catch(function (err) {
            console.log("got error in get_account_info");           
            console.error(err);
            specs_local.account_err = err
            update_stellar_net_escrow_account_status(specs_local.order_id,4);
            // status 10 on order_status = fail
            update_order_status_id(specs_local.order_id,10);                 
          })
    
  }

  function isValidSigner(publicId,signed_tx){
    var signer = StellarSdk.Keypair.fromPublicKey(publicId);
    var env = signed_tx.toEnvelope();
    var rawSig = env.signatures()[0].signature();
    return signer.verify(signed_tx.hash(), rawSig);
  }

  function compare_hash(v1,v2){
    for (var i = 0; i < v1.length; i++) {
      if (v1[i] != v2[i]){
        return false;
      }
    }
    return true;
  }

  function process_tx(specs_local){
       console.log("start process_tx");
         //this generates a mirror image of the timed escrow payment transaction, then compares this with
         // the customers version they sent us, if it matches update db status
         // specs_local object includes:

         // specs_local.destination // the store payment address 
         // specs_local.asset_code  // what is accepted by the store
         // specs_local.asset_issuer
         // specs_local.amount
         // specs_local.memo  // this becomes the stores order_id number in a text memo
         // specs_local.minTime  // timestamp that is also called expire_ts
         // specs_local.maxTime  // just set to zero in this case
         // specs_local.escrow_publicId  // the escrow holding account
         // specs_local.escrow_service_publicId // the 3rd party escrow signer for escrow_publicId account 
           // values bellow not used in this function but use in check_escrow_holding_account
         // specs_local.signer_weight : weights settings on all low,med,high signer weights (normally 2)
         // specs_local.signer_count : total number of signers on this account (normally 3)
         //specs_local.escrow_hours : number of hours after order was made to when it must expire (with some tolerance or about 100 sec)

    // specs post get_stellar_net_orders:
    //specs_local.escrow_b64_tx : the timed transaction sent by the customer for this purchase
    //specs_local.memo = rows[i].order_id.toString();
    //specs_local.order_id = rows[i].order_id;
    //specs_local.escrow_expire_ts : mysql format of valid transaction time
    //specs_local.minTime : the timestamp that the customer has set for the valid time of this escrow transaction
    //specs_local.escrow_publicId : the escrow holding account for this transaction
    //specs_local.capture_status : the presently recorded value of captured status on this order_id stellar order
    //specs_local.rec_total : the amount the sender says he sent us (won't really know until we look inside escrow_b64_tx)
     // post get_order
    //specs_local.amount : the value that OpenCart says this order_id should send us


         // added here specs_local values 
         // specs_local.tx_ok : true or false // that indicates the mirror image matches what was sent (true) or not (false)
         // specs_local.tx_hash  ; the hash of the unsigned transactions 
         // specs_local.escrow_tx_hash
         // specs_local.escrow_tx
         // specs_local.escrow_source  // the account that funded the escrow_publicId account and will be return address of XLM that funded it

        // example specs_local: 
         //{ maxTime: '0',
  //escrow_vendor_signer_secret: '',
  //escrow_signer_publicId: 'GDUPQLNDVSUKJ4XKQQDITC7RFYCJTROCR6AMUBAMPGBIZXQU4UTAGX7C',
  //signer_weight: 2,
  //signer_count: 3,
  //escrow_hours: '0.10',
  //testnet_mode: '1',
  //escrow_service_publicId: 'GAVUFP3ZYPZUI2WBSFAGRMDWUWK2UDCPD4ODIIADOILQKB4GI3APVGIF',
  //asset_code: 'USD',
  //asset_issuer: 'GCEZWKCA5VLDNRLN3RPRJMRZOX3Z6G5CHCGSNFHEYVXM3XOJMDS674JZ',
  //destination: 'GDUPQLNDVSUKJ4XKQQDITC7RFYCJTROCR6AMUBAMPGBIZXQU4UTAGX7C',
  //escrow_expire_ts_f2: 1490163087,
  //expected_escrow_expire_ts: 1490163114,
  //date_added: 'Sun Mar 26 2017 15:59:27 GMT+0700 (ICT)',
 // escrow_b64_tx: 'AAAAALrMseUzYfji4rKYwumhUzM0a6u6o PXQ/N QCENEah5AAAAyAAAhkcAAAABAAAAAQAAAABY0hWPAAAAAAAAAAAAAAAAAAAAAgAAAAAAAAABAAAAAOj4LaOsqKTy6oQGiYvxLgSZxcKPgMoEDHmCjN4U5SYDAAAAAVVTRAAAAAAAiZsoQO1WNsVt3F8Usjl1958bojiNJpTkxW7N3clg5e8AAAAAMqn4gAAAAAAAAAAIAAAAAImbKEDtVjbFbdxfFLI5dfefG6I4jSaU5MVuzd3JYOXvAAAAAAAAAAENEah5AAAAQJQP0jBnwSmDz1vJsbZHFTE6jc/AsIurYVNPOCYoYhf971iWBl9WpWt1zvprYqyU8NfK/ItwyOL4YS42NKd NgU=',
  //memo: '73',
  //order_id: 73,
  //escrow_expire_ts: 'Sun Mar 26 2017 15:59:27 GMT+0700 (ICT)',
  //minTime: 1490163087,
  //escrow_publicId: 'GC5MZMPFGNQ7RYXCWKMMF2NBKMZTI25LXKR6HV2D6N7EAIINCGUHTNSP',
  //capture_status: 2,
  //rec_total: 85,
  //amount: 85,
  //account_ok: true }

         console.log("specs_local: ");
         console.log(specs_local);
         try{
           specs_local.escrow_tx = new StellarSdk.Transaction(decodeURIComponent(specs_local.escrow_b64_tx));
           specs_local.escrow_tx_hash = specs_local.escrow_tx.hash();
           specs_local.escrow_source = specs_local.escrow_tx.operations[2].destination;
           
           console.log(specs_local.escrow_source);
         }catch(err) {
            console.log("Error: specs_local.escrow_b64_tx decode on order_id: ", specs_local.order_id);
            // update status failed
             // status: 0 untested, 1 timed transaction passed specs, 2 failed escrow_b64_tx decode, 3 failed has no valid signer, 4=> fails other 
            update_stellar_net_status(specs_local.order_id, 2);
            // status 10 on order_status = fail
            update_order_status_id(specs_local.order_id,10);
            return;
         } 

         if (isValidSigner(specs_local.escrow_publicId,specs_local.escrow_tx)){
            console.log("hasValidSigner Passed!!");
         }else{
            console.log("Error: hasValidSigner failed");
            // update status failed
            update_stellar_net_status(specs_local.order_id, 3);
            // status 10 on order_status = fail
            update_order_status_id(specs_local.order_id,10);
            return;
         }
          // generate mirror clone of transaction we expect from customer:
               var tx_array = [];
               var asset;
               if (specs_local.asset_code != "XLM"){
                 asset = new StellarSdk.Asset(specs_local.asset_code, specs_local.asset_issuer);
               }else{
                 asset = new StellarSdk.Asset.native();
               }
               // the vendor now gets the asset sent to his store account
               tx_array.push(StellarSdk.Operation.payment({
                 destination: specs_local.destination,
                 amount: specs_local.amount.toString(),
                 asset: asset
               }));

               // remove trust in our added asset to allow accountMerge bellow               
               tx_array.push(StellarSdk.Operation.changeTrust({asset: asset,limit: "0"}));              

               //send back what's left of the XLM back to the buyer who created the escrow.
               tx_array.push(StellarSdk.Operation.accountMerge({
                 destination: specs_local.escrow_source
               })); 

               server.loadAccount(specs_local.escrow_publicId)
                .then(function (account) {
                  // this transaction won't be valid until escrow expire timestamp date and time
                  var timebounds = {
                    minTime: specs_local.minTime.toString(),
                    maxTime: specs_local.maxTime.toString()
                  };
                  var memo_tr = StellarSdk.Memo.text(specs_local.memo);
                  transaction = new StellarSdk.TransactionBuilder(account,{timebounds, memo: memo_tr});         
                  tx_array.forEach(function (item) {
                    transaction.addOperation(item);
                  });
                  transaction = transaction.build();
                  //transaction.sign(remote_txData.keypair_escrow); 
                  //return transaction.toEnvelope().toXDR().toString("base64");
                  specs_local.b64_tx = transaction.toEnvelope().toXDR().toString("base64");
                  
                  //console.log("specs_local.b64_tx: ");
                  //console.log(specs_local.b64_tx);
                  specs_local.tx_hash = transaction.hash();

                  // this try should be at the top before we bother generating a mirror clone tx to verify we at least have 
                  // a captured valid b64 transaction, but I'll try this first for debuging
                  try{
                    specs_local.escrow_tx = new StellarSdk.Transaction(decodeURIComponent(specs_local.escrow_b64_tx));
                    specs_local.escrow_tx_hash = specs_local.escrow_tx.hash();
   // status: 0 untested, 1 timed transaction passed specs, 2 failed escrow_b64_tx decode, 3 failed has no valid signer, 4 fails tx inspection , 5 fails escrow_tx decode or other                   
                    //console.log("escrow_tx hash");
                    //console.log(specs_local.escrow_tx.hash());
                    // now we have the recieved tx and mirror clone tx hashes to compare
                    if (compare_hash(specs_local.escrow_tx_hash,specs_local.tx_hash)){
                       console.log("escrow tx matches expected results on order_id: ",specs_local.order_id);
                       // update status processed
                        update_stellar_net_status(specs_local.order_id, 1);
                    } else{
                       console.log("Error: escrow tx fails inspection on order_id: ", specs_local.order_id);
                       // update status failed
                        update_stellar_net_status(specs_local.order_id, 4);
                        // status 10 on order_status = fail
                        update_order_status_id(specs_local.order_id,10);
                    }
                  } catch(err) {
                     console.log("Error: tx decode on order_id: ",specs_local.order_id);
                     // update status failed
                      update_stellar_net_status(specs_local.order_id, 5);
                      // status 10 on order_status = fail
                      update_order_status_id(specs_local.order_id,10);
                  }
                
               });
             
      }

  function mysql_to_unix_time(date) {
    return Math.floor(new Date(date).getTime() / 1000);
  }

  function unix_to_mysql_time(unix_tm) {
        var dt = new Date(unix_tm*1000);
        return dt;
  }

  function get_stellar_net_orders(callback){
    console.log("start get_stellar_net_orders");

    //specs_local.escrow_hours : number of hours after order was made to when it must expire (with some tolerance or about 1000 sec 16min)
    con.query('SELECT * FROM oc_stellar_net_order',function(err,rows){
      if(err) throw err;

      console.log('Data received from Db:\n');
      //console.log(rows);
      for (var i = 0; i < rows.length; i++) {
        //console.log("get_stellar_net_orders return: ");
        //console.log(rows[i]);
        if (rows[i].capture_status == 1 && rows[i].escrow_account_status == 1){
          console.log("both capture_status and escrow_account_status == 1, will set oc_order status to proccessing");
          update_order_status_id(rows[i].order_id,15);
          // check if specs.escrow_expire_ts is less than now() time, if so submit escrow_b64_tx to stellar net for escrow capture
          var escrow_expire_ts = mysql_to_unix_time(rows[i].escrow_expire_ts);
          var time_now_ts = Math.floor(Date.now() / 1000);
          console.log("time_now_ts: ", time_now_ts);
          console.log("escrow_expire_ts: ",escrow_expire_ts);
          if (escrow_expire_ts < time_now_ts && (rows[i].escrow_collected < 1 || rows[i].escrow_collected == null) ){
            console.log("found expired escrow will submit to stellar net for order_id: " ,rows[i].order_id);
            submit_stellar_tx(rows[i].escrow_b64_tx,rows[i].order_id);
          }
        } else{
          var expected_escrow_expire_ts = mysql_to_unix_time(rows[i].date_added) + (specs.escrow_hours * 60 * 60);
          var escrow_expire_ts = mysql_to_unix_time(rows[i].escrow_expire_ts);
          console.log("pre-proccessed escrow_expire_ts: ",rows[i].escrow_expire_ts);
          console.log("escrow_expire_ts: ",escrow_expire_ts);
          console.log("expected_escrow_expire_ts: ",expected_escrow_expire_ts);
          if (escrow_expire_ts > (expected_escrow_expire_ts + 1000) || (escrow_expire_ts < (expected_escrow_expire_ts - 1000))){
            console.log("Error: escrow_expire_ts is out of tolerance, will not process");
            // update oc_order db status
            // update status failed
            update_stellar_net_status(specs_local.order_id, 6);
            // status 10 on order_status = fail
            update_order_status_id(specs_local.order_id,10);
            return;
          }
          specs.escrow_expire_ts_f2 = escrow_expire_ts;
          specs.expected_escrow_expire_ts = expected_escrow_expire_ts;
          specs.date_added = rows[i].date_added;
          specs.escrow_b64_tx = rows[i].escrow_b64_tx;
          specs.memo = rows[i].order_id.toString();
          specs.order_id = rows[i].order_id;
          specs.escrow_expire_ts = rows[i].escrow_expire_ts;
          // this minTime must sooner or later be checked that it is within time specs of the store, this is just the number that the customer has chosen
          specs.minTime = mysql_to_unix_time(rows[i].escrow_expire_ts);
          specs.escrow_publicId = rows[i].escrow_publicId;
          specs.capture_status = rows[i].capture_status;
          specs.rec_total = rows[i].total;
          var specs_local = clone(specs);
          get_order(specs_local);
        }      
      };
      // at this point I don't think we need callback
      //callback();
    });
  }

  function submit_stellar_tx(b64_string,order_id){
     // escrow_collected code:
     // 1 tx completed ok, 2 tx_bad_auth, 3 transaction error, 4 transaction results undefined, 5 transaction error ? 
       console.log("start submit_stellar_tx *********************");
       console.log("b64: ",b64_string);
       var transaction = new StellarSdk.Transaction(b64_string);
       // sign with escrow_vendor_signer_secret keypair to provide 2 of 3 sigs needed (buyer and vendor in this case)
       console.log("Signing with publicId: ",StellarSdk.Keypair.fromSecret(specs.escrow_vendor_signer_secret).publicKey()); 
       transaction.sign(StellarSdk.Keypair.fromSecret(specs.escrow_vendor_signer_secret));
          server.submitTransaction(transaction).then(function(result) {              
               console.log("submit_stellar_tx Completed OK ******************************************************");
               update_stellar_net_escrow_collected(order_id,1);
             }).catch(function(e) {
               console.log("submitTransaction error ********************");
               console.log(e);
               if (e.extras.result_codes.transaction == "tx_bad_auth"){
                  console.log("Transaction error: tx_bad_auth *******************");
                  update_stellar_net_escrow_collected(order_id,2);
               } else {           
                 console.log("Transaction error: " + e.extras.result_codes.operations[0] + " *************************");
                 update_stellar_net_escrow_collected(order_id,3);
               }                      
          })
          .then(function (transactionResult) {
            console.log("tx_result");
            console.log(transactionResult);
            if (typeof transactionResult == "undefined") {
              console.log("tx res undefined, ************************");
              //update_stellar_net_escrow_collected(order_id,4);
            }            
          })
          .catch(function (err) {
            console.log("Transaction Error: " + err + " ******************************");
            update_stellar_net_escrow_collected(order_id,5); 
          });
     }


  function check_stellar_net_status(callback){
    console.log("check_stellar_net_status");
    con.query('SELECT * FROM oc_stellar_net_order',function(err,rows){
      if(err) throw err;
      //console.log(rows);
      for (var i = 0; i < rows.length; i++) {       
        if (rows[i].capture_status == 1 && rows[i].escrow_account_status == 1){
          console.log("both status 1 on order_id: ", rows[i].order_id);
          //update oc_order status to processing
          update_order_status_id(rows[i].order_id,15);
        }            
      };
      // at this point I don't think we need callback
      callback();
    });
  }


  function get_order(specs_local){
    // fill in added info needed to specs_local from this specs_local.order_id
    // then check to be sure that expire_ts is within spec before we continue transaction processing
    // with added info then call process_tx and check_escrow_holding_account   

    // specs post get_stellar_net_orders:
    //specs_local.escrow_b64_tx : the timed transaction sent by the customer for this purchase
    //specs_local.memo = rows[i].order_id.toString();
    //specs_local.order_id = rows[i].order_id;
    //specs_local.escrow_expire_ts : mysql format of valid transaction time provided by customer 
    //specs_local.minTime : the timestamp that the customer has set for the valid time of this escrow transaction
    //specs_local.escrow_publicId : the escrow holding account for this transaction
    //specs_local.capture_status : the presently recorded value of captured status on this order_id stellar order
    //specs_local.rec_total : the amount the sender says he sent us (won't really know until we look inside escrow_b64_tx)
     // post get_order
    //specs_local.amount : the value that OpenCart says this order_id should send us
    //specs_local.escrow_hours : number of hours after order was made to when it must expire (with some tolerance or about 100 sec)

    
    console.log("get_order order_id: ",specs_local.order_id);
    var order_id = specs_local.order_id;
    // only 1 row will be return for order_id = x
    // at this point I guess all we need is the total of the purchase for this order_id, all other info needed already collected 
    con.query('SELECT * FROM oc_order WHERE order_id = ' + order_id,function(err,rows){
      if(err) throw err;
      specs_local.amount = rows[0].total;      
      console.log('Data received from get_order order_id: ', order_id);      
      //console.log(rows[0]);
      // we now have all the data so should process here
      check_escrow_holding_account(specs_local);
      process_tx(specs_local);      
    });
  }


  function update_stellar_net_status(order_id,status){
    console.log("update_stellar_net_status");
    // status: 0 untested, 1 timed transaction passed specs, 2 failed escrow_b64_tx decode, 3 failed has no valid signer,
    // 4 fails tx inspection , 5 fails escrow_tx decode or other, 6 fails escrow_expire_ts out of tolerance  
    con.query("UPDATE `oc_stellar_net_order` SET capture_status = '" + status + "', `date_modified` = now() WHERE order_id = " + order_id, function(err,res){
        if(err) throw err;
        //console.log('Last edit result:', res);        
    });
  }

  function update_stellar_net_escrow_account_status(order_id,status){
    console.log("update_stellar_net_escrow_account_status");
    // escrow_account_status: 0 untested, 1 escrow account ok, 2 specs fail, 3 signers fail, 4 got error in get_account_info (no funding?)  
    con.query("UPDATE `oc_stellar_net_order` SET escrow_account_status = '" + status + "', `date_modified` = now() WHERE order_id = " + order_id, function(err,res){
        if(err) throw err;
        //console.log('Last edit result:', res);        
    });
  }

  function update_stellar_net_escrow_collected(order_id,status){
     console.log("update_stellar_net_escrow_collected");
   // 1 tx completed ok, 2 tx_bad_auth, 3 transaction error, 4 transaction results undefined, 5 transaction error ? 
    // default null untested, 0 all escrow pre-processing pass, 1 escrow collected to store account, 2 > see above
    con.query("UPDATE `oc_stellar_net_order` SET escrow_collected = '" + status + "', `date_modified` = now() WHERE order_id = " + order_id, function(err,res){
        if(err) throw err;
        //console.log('Last edit result:', res);        
    });
  }


  function update_order_status_id(order_id,status){
     console.log("update_order_status_id");
     //1= pending, 2 = processing, 3 = shipped, 7 = canceled, 10 = failed, 15 = processed, 
    con.query("UPDATE `oc_order` SET order_status_id = '" + status + "', `date_modified` = now() WHERE order_id = " + order_id, function(err,res){
        if(err) throw err;
        //console.log('Last edit result:', res);       
    });

  }


  function close_db(){
    con.end(function(err) {
    // The connection is terminated gracefully
    // Ensures all previously enqueued queries are still
    // before sending a COM_QUIT packet to the MySQL server.
    });
 }

  function clone(obj) {
    if (null == obj || "object" != typeof obj) return obj;
    var copy = obj.constructor();
    for (var attr in obj) {
        if (obj.hasOwnProperty(attr)) copy[attr] = clone(obj[attr]);
    }
    return copy;
  }

  
  function restart(){
    // this didn't end up working went with cron event every 5 min for now 
    console.log("restart");
    //close_db;
    //con.connect(function(err){
    //  if(err){
    //    console.log('Error connecting to Db');
    //    return;
    //  }
    //  console.log('Connection established');
    //});
    start();
  }

// with this present method we run the program then after 20 sec close the db that allow the program to exit normally
// so it will be ready for the next cron call event 
// I will set the cron to run this program every 5 min as 6 min (0.10 hours) is what I presently have the test_store
// escrow expire time.  so this way the test user can see a full cycle of escrow from his wallet within 10 min time frame.
// 20 sec was chosen as we have no idea how long it will take to process many payments.  it seems to only take less than 5 sec for 2 transactions. 
setTimeout(close_db,20000);

start();




