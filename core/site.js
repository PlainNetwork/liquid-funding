const config = {};
StellarSdk.Network.useTestNetwork();
async function readyForBlockchain() {
    $("#loading").lock();
    config.server = new StellarSdk.Server('https://horizon-testnet.stellar.org');
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
    const [
        platform,
        collateral,
        operations
    ] = await Promise.all([
        config.server.loadAccount(config.platformKey.publicKey()),
        config.server.loadAccount(config.collateralKey.publicKey()),
        config.server.operations().forAccount(config.collateralKey.publicKey()).limit(20).order("desc").call()
    ])
    config.platform = platform
    config.collateral = collateral
    const min = config.collateral.subentry_count * 0.5 + 1;

    const xlmc = findBalance(collateral, config.assetXLMC);
    const krw  = findBalance(collateral, config.assetKRW);
    $("#user_xlm").text((Number(findBalance(collateral, config.assetXLM).balance) - min) + " " + config.assetXLM.code)
    if (xlmc) {
        $("#user_xlmc").text((Number(xlmc.balance)) + " " + config.assetXLMC.code)
    } else {
        $("#user_xlmc").html($("<a/>", {
            text:`Need Trust`,
            href: `javascript:changeTrust('${config.assetXLMC.code}', '${config.assetXLMC.issuer}', undefined)`
        }))
    }
    if (krw) {
        $("#user_krw").text((Number(krw.balance)) + " " + config.assetKRW.code)
    } else {
        $("#user_krw").html($("<a/>", {
            text: `Need Trust`,
            href: `javascript:changeTrust('${config.assetKRW.code}', '${config.assetKRW.issuer}', undefined)`
        }))
    }
    $("#user_id").text(config.collateral.id);
    var qr = qrcode(0, 'L');
    qr.addData(config.collateral.id);
    qr.make();
    $("#user_qr").html([qr.createImgTag(4, 4, config.collateral.id)]);

    const histories = [];
    operations.records.forEach(function(row) {
        if (row.type == "payment") {
            let asset = null;
            if (row.asset_type == "native") {
                asset = config.assetXLM;
            } else {
                asset = new StellarSdk.Asset(row.asset_code, row.asset_issuer)
            }
            let direction = row.from == config.collateral.id ? "Sent" : "Recieve";
            let hot = new Date().getTime() - new Date(row.created_at).getTime() < 30 * 1000
            let $div = $("<div/>", {
                "class": "hisotry-row"
            });
            $div.append($("<span/>",{
                text: `${direction} ${row.amount} ${asset.code}`
            }));
            $div.append($("<span/>", {
                text: moment(row.created_at).fromNow()
            }));
            $div.on('click', function() {
                window.open(`https://stellar.expert/explorer/public/tx/${row.transaction_hash}`)
            })
            if (hot) {
                $div.addClass("hot")
            }
            histories.push($div);
        }
    })
    $("#history").html(histories);
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
        amount: (amount * 100) + "",
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
async function changeTrust(assetCode, assetIssuer, amount) {
    if ($("#loading").lock()) {
        return;
    }
    $("#loading_mask").show();
    const builder = new StellarSdk.TransactionBuilder(config.platform, {
        fee: config.fee
    }).addOperation(StellarSdk.Operation.changeTrust({
        asset: new StellarSdk.Asset(assetCode, assetIssuer),
        limit: amount,
        source: config.collateral.id
    }))
    const tx = builder.setTimeout(100).build();
    tx.sign(config.platformKey)
    await config.server.submitTransaction(tx);
    await refreshBlockchain();
    resultMessage("done")
}
async function changeSigner() {
    if ($("#loading").lock()) {
        return;
    }
    $("#loading_mask").show();
    const builder = new StellarSdk.TransactionBuilder(config.platform, {
        fee: config.fee
    }).addOperation(StellarSdk.Operation.setOptions({
        signer: {
            ed25519PublicKey: config.platform.id,
            weight: 1,
        },
        masterWeight: 1,
        highThreshold: 1,
        medThreshold: 1,
        lowThreshold: 1,
        source: config.collateral.id,
    }))
    const tx = builder.setTimeout(100).build();
    tx.sign(config.collateralKey)
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