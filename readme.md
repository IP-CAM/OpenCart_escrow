#(c) 2017 Mar 23. by sacarlson  sacarlson_2000@yahoo.com

# install
cd OpenCart_escrow
npm install

# run
node app.js

# on fresh ubuntu install
 apt-get install npm
 npm install 
 nodejs app.js
or run ./start.sh that can also be run from cron
note for ./start.sh you will have to modify the path to suit your install point

# setup
 you must setup the mysql user: password:  db: that is hard coded within app.js
 also with present bug you will have to manualy install the oc_stellar_net_order.sql file within your presently installed OpenCart
 for this I use phpmyadmin, if upgrading to the slightly newer sql table format it's best to drop the present table and create a new one.

# cron setup example
*/5 * * * * /home/sacarlson/github/stellar/OpenCart_escrow/start.sh


# OpenCart Stellar Plugin Proccesor (OCSPP)
  This program is used to process escrow payments for OpenCart Stellar Plugin (OCSP)
  This program is NOT needed if you are using OCSP with escrow disabled
  What this does is periodicaly scans the captured transaction that OCSP creates when a customer purchases something
  in the store with the Stellar Plugin in escrow mode.

  What the OCSPP then does is analize each purchase contract that contains these items in a mysql table oc_stellar_net_order:
   order_id: The order number in the store that this purchase pertains to
   escrow_b64_tx: A base64 encoded stellar transaction envelope presigned by the customer (1 sig but needs 2) that becomes valid in time
   date_added: The data and time that the transaction was added to the store
   escrow_publicId: The escrows PublicId or the account used to hold the locked 2 of 3 signers escrowed funds 
   escrow_expire_ts: timestamp that the escrow expires and the escrow_b64_tx transaction becomes valid to transact
   total: the total amount of the purchase for this order_id 
   
#   Capture_status: the present known state of this payment enumerated
     0: no payment recorded yet
     1: proccessing, payment from wallet is now seen as recorded in table
     2: processed, escrow payment has now been analized to meet contract and awaits escrow expire time to capture funds
     3: captured, the funds have now been moved from the escrow account to the stores receiving account 
     4: pre_processing error: failure was detected escrow_b64_tx was analized to meet contract agreements
       this would happin due to lack of funds in escrow_publicId account or if contract time not within tolerance, specified signers not authorized...
     5: post_processing error: This is where the timed transaction hit it's valid time and an attempt to transact the transaction failed for many reasons.

   This will be done in two waves of processing,  first pre_processing transaction will be done, then post_processing transaction with
   expired valid tx times will be searched for and transactions processed.

 note unprocessed status level defaults to null

#   PreProcessing level 0:
 will search for transactions on record in status level 0 (processing).  it will decode the escrow_b64_tx elements and compare
 them with the configured specs for this stores contracts
 contract specs include:
 asset_code: asset code  accepts as payment:
 issuer: the issuer publicId of the asset code above accepts as payment
 expire time: time in hours from when the purchase was record that the escrow will expire and the escrow_b64_tx becomes valid to transact
 destination publicId: The final destination of the assets that in the escrow_b64_tx
 amount: The amount of the asset that is set to be paid to the destination and that this amount of asset is present within the escrow_publicId account.

#   PostProcessing:
 will search for transactins in status level 1 (processed) and also have escrow_expire_ts that has now expired and can be transacted on the stellar net
 the escrow_b64_tx will be submited to the stellar net and results recorded in capture_status in the db of 3: if successful 5: if failed to transact
 
