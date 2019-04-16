const config = {};
StellarSdk.Network.usePublicNetwork();
async function readyForBlockchain() {
    $("#loading").lock();
    config.server = new StellarSdk.Server('https://horizon.stellar.org');
    config.web3 = new Web3('https://rinkeby.infura.io');

    config.assetXLM = StellarSdk.Asset.native();
    config.assetXLMC = new StellarSdk.Asset("XLMC", "GCCZALMK4YG44CUKMOXQZAXNQDSTFW6T7EIDZANGIGOJDSYU62B4UXRD");
    config.assetKRW = new StellarSdk.Asset("KRW", "GCCZALMK4YG44CUKMOXQZAXNQDSTFW6T7EIDZANGIGOJDSYU62B4UXRD");

    config.platformKey = StellarSdk.Keypair.fromSecret("SDLOQYBEYBPUCZMWSYC275TQGGN7FG6JEQBSWMAOCRYDK5INFEXFOK5R");
    config.collateralKey = StellarSdk.Keypair.fromSecret("SAMPEKPCJYGDRUIWSLCGTK3TD47NNNMQJJXMQTDKMIVKHLB7FKPTFDHA");

    config.fee = await config.server.fetchBaseFee();
    await refreshBlockchain();
}

async function refresh() {
    if ($("#loading").lock()) {
        return;
    }
    $("#loading_mask").show();
    await refreshBlockchain();
    resultMessage("done");
}
async function refreshBlockchain() {
    resultMessage("Ready");
    const [platform, collateral, operations] = await Promise.all([
        config.server.loadAccount(config.platformKey.publicKey()),
        config.server.loadAccount(config.collateralKey.publicKey()),
        config.server.operations().forAccount(config.collateralKey.publicKey()).limit(20).order("desc").call()
    ])
    config.platform = platform
    config.collateral = collateral
    const min = config.collateral.subentry_count * 0.5 + 1;
    $("#user_xlm").text((Number(findBalance(collateral, config.assetXLM).balance) - min) + config.assetXLM.code)
    $("#user_xlmc").text((Number(findBalance(collateral, config.assetXLMC).balance)) + config.assetXLMC.code)
    $("#user_krw").text((Number(findBalance(collateral, config.assetKRW).balance)) + config.assetKRW.code)
    $("#user_id").text(config.collateral.id);
    var qr = qrcode(0, 'L');
    qr.addData(config.collateral.id);
    qr.make();
    $("#user_qr").html([qr.createImgTag(4, 4, config.collateral.id)]);

    $("#history").empty();
    operations.records.forEach(function(row) {
        if (row.type == "payment") {
            let asset = null;
            if (row.asset_type == "native") {
                asset = config.assetXLM;
            } else {
                asset = new StellarSdk.Asset(row.asset_code, row.asset_issuer)
            }
            let direction = row.from == config.collateral.id ? "Send" : "Recieve";
            var $div = $("<div/>", {
                "class": "hisotry-row"
            }).text(`${direction} ${row.amount} ${asset.code}`);
            $div.on('click', function() {
                window.open(`https://stellar.expert/explorer/public/tx/${row.transaction_hash}`)
            })
            $div.appendTo($("#history"));
        }
    })
    console.log(operations.records);
}
async function transXLMtoXLMC() {
    const min = config.collateral.subentry_count * 0.5 + 1;
    const amount = Number(findBalance(config.collateral, config.assetXLM).balance) - min;
    if (amount <= 0) {
        return;
    }
    if ($("#loading").lock()) {
        return;
    }
    $("#loading_mask").show();
    const builder = new StellarSdk.TransactionBuilder(config.platform, {
        fee: config.fee
    }).addOperation(StellarSdk.Operation.payment({
        amount: amount + "",
        destination: config.platform.id,
        asset: config.assetXLM,
        source: config.collateral.id,
    })).addOperation(StellarSdk.Operation.payment({
        amount: amount + "",
        destination: config.collateral.id,
        asset: config.assetXLMC,
        source: config.platform.id,
    })).addOperation(StellarSdk.Operation.payment({
        amount: (amount * 10000) + "",
        destination: config.collateral.id,
        asset: config.assetKRW,
        source: config.platform.id,
    }))
    const tx = builder.setTimeout(100).build();
    tx.sign(config.platformKey)
    await config.server.submitTransaction(tx);
    await refreshBlockchain();
    resultMessage("done")
}
async function transKRW() {
    const amount = Number(findBalance(config.collateral, config.assetKRW).balance);
    if (amount <= 0) {
        return;
    }
    if ($("#loading").lock()) {
        return;
    }
    $("#loading_mask").show();
    const builder = new StellarSdk.TransactionBuilder(config.platform, {
        fee: config.fee
    }).addOperation(StellarSdk.Operation.payment({
        amount: amount + "",
        destination: config.platform.id,
        asset: config.assetKRW,
        source: config.collateral.id,
    }))
    const tx = builder.setTimeout(100).build();
    tx.sign(config.platformKey)
    await config.server.submitTransaction(tx);
    await refreshBlockchain();
    resultMessage("done")
}

async function transXLMCtoXLM() {
    const amount = Number(findBalance(config.collateral, config.assetXLMC).balance);
    if (amount <= 0) {
        return;
    }
    if ($("#loading").lock()) {
        return;
    }
    $("#loading_mask").show();
    const builder = new StellarSdk.TransactionBuilder(config.platform, {
        fee: config.fee
    }).addOperation(StellarSdk.Operation.payment({
        amount: amount + "",
        destination: config.collateral.id,
        asset: config.assetXLM,
        source: config.platform.id,
    })).addOperation(StellarSdk.Operation.payment({
        amount: amount + "",
        destination: config.platform.id,
        asset: config.assetXLMC,
        source: config.collateral.id,
    }));
    const tx = builder.setTimeout(100).build();
    tx.sign(config.platformKey)
    await config.server.submitTransaction(tx);
    await refreshBlockchain();
    resultMessage("done")
}
function findBalance(account, asset) {
    const balance = account.balances.find(item => {
        switch (item.asset_type) {
            case "credit_alphanum4":
            case "credit_alphanum12":
                if (item.asset_code == asset.code
                    && item.asset_issuer == asset.issuer) {
                    return true;
                }
                break;
            case "native":
                if (asset.issuer == undefined) {
                    return true;
                }
        }
        return false;
    })
    return balance;
}
function resultMessage(message) {
    $("#loading").unlock();
    $("#loading_mask").fadeOut(300);
}