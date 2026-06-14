/**
 * Program IDL in camelCase format in order to be used in JS/TS.
 *
 * Note that this is only a type helper and is not the actual IDL. The original
 * IDL can be found at `target/idl/fluxperp.json`.
 */
export type Fluxperp = {
  "address": "9AT996FhU1n73PRDHLiQKZHBcwAPRiUVDSN71CgGso8S",
  "metadata": {
    "name": "fluxperp",
    "version": "0.1.0",
    "spec": "0.1.0",
    "description": "Created with Anchor"
  },
  "instructions": [
    {
      "name": "applyFunding",
      "discriminator": [
        199,
        170,
        102,
        61,
        252,
        86,
        228,
        184
      ],
      "accounts": [
        {
          "name": "cranker",
          "signer": true
        },
        {
          "name": "priceFeed"
        },
        {
          "name": "orderbook",
          "writable": true
        }
      ],
      "args": [
        {
          "name": "marketIndex",
          "type": "u8"
        }
      ]
    },
    {
      "name": "autoDeleverage",
      "discriminator": [
        210,
        69,
        163,
        148,
        44,
        245,
        226,
        170
      ],
      "accounts": [
        {
          "name": "cranker",
          "signer": true
        },
        {
          "name": "marketConfig"
        },
        {
          "name": "priceFeed"
        }
      ],
      "args": [
        {
          "name": "marketIndex",
          "type": "u8"
        },
        {
          "name": "count",
          "type": "u8"
        },
        {
          "name": "bankruptcyPrice",
          "type": "u64"
        }
      ]
    },
    {
      "name": "cancelOrder",
      "discriminator": [
        95,
        129,
        237,
        240,
        8,
        49,
        223,
        132
      ],
      "accounts": [
        {
          "name": "owner",
          "signer": true
        },
        {
          "name": "orderbook",
          "writable": true
        }
      ],
      "args": [
        {
          "name": "marketIndex",
          "type": "u8"
        },
        {
          "name": "orderId",
          "type": "u64"
        }
      ]
    },
    {
      "name": "cancelTrigger",
      "discriminator": [
        208,
        139,
        249,
        52,
        247,
        33,
        57,
        223
      ],
      "accounts": [
        {
          "name": "user",
          "signer": true
        },
        {
          "name": "triggers",
          "writable": true
        }
      ],
      "args": [
        {
          "name": "marketIndex",
          "type": "u8"
        },
        {
          "name": "kind",
          "type": {
            "defined": {
              "name": "triggerKind"
            }
          }
        },
        {
          "name": "triggerPrice",
          "type": "u64"
        },
        {
          "name": "size",
          "type": "u64"
        },
        {
          "name": "fireSide",
          "type": {
            "defined": {
              "name": "side"
            }
          }
        }
      ]
    },
    {
      "name": "closePosition",
      "discriminator": [
        123,
        134,
        81,
        0,
        49,
        68,
        98,
        98
      ],
      "accounts": [
        {
          "name": "taker",
          "signer": true
        },
        {
          "name": "marketConfig"
        },
        {
          "name": "orderbook",
          "writable": true
        },
        {
          "name": "fillLog",
          "writable": true
        },
        {
          "name": "takerPosition",
          "writable": true
        },
        {
          "name": "takerCollateral",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  108,
                  108,
                  97,
                  116,
                  101,
                  114,
                  97,
                  108
                ]
              },
              {
                "kind": "account",
                "path": "taker"
              }
            ]
          }
        }
      ],
      "args": [
        {
          "name": "marketIndex",
          "type": "u8"
        }
      ]
    },
    {
      "name": "commitState",
      "discriminator": [
        201,
        80,
        148,
        145,
        9,
        196,
        225,
        56
      ],
      "accounts": [
        {
          "name": "payer",
          "writable": true,
          "signer": true
        },
        {
          "name": "insuranceFund"
        },
        {
          "name": "magicProgram",
          "address": "Magic11111111111111111111111111111111111111"
        },
        {
          "name": "magicContext",
          "writable": true,
          "address": "MagicContext1111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "marketIndex",
          "type": "u8"
        },
        {
          "name": "insuranceDelta",
          "type": "u64"
        },
        {
          "name": "protocolDelta",
          "type": "u64"
        }
      ]
    },
    {
      "name": "crankTriggers",
      "discriminator": [
        76,
        73,
        99,
        65,
        51,
        166,
        110,
        91
      ],
      "accounts": [
        {
          "name": "cranker",
          "signer": true
        },
        {
          "name": "marketConfig"
        },
        {
          "name": "priceFeed"
        },
        {
          "name": "orderbook",
          "writable": true
        },
        {
          "name": "fillLog",
          "writable": true
        },
        {
          "name": "traderTriggers",
          "writable": true
        },
        {
          "name": "traderPosition",
          "writable": true
        },
        {
          "name": "traderCollateral",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  108,
                  108,
                  97,
                  116,
                  101,
                  114,
                  97,
                  108
                ]
              },
              {
                "kind": "arg",
                "path": "trader"
              }
            ]
          }
        }
      ],
      "args": [
        {
          "name": "marketIndex",
          "type": "u8"
        },
        {
          "name": "trader",
          "type": "pubkey"
        }
      ]
    },
    {
      "name": "crankTwap",
      "discriminator": [
        43,
        127,
        177,
        237,
        243,
        153,
        31,
        162
      ],
      "accounts": [
        {
          "name": "cranker",
          "signer": true
        },
        {
          "name": "orderbook",
          "writable": true
        },
        {
          "name": "advanced",
          "writable": true
        }
      ],
      "args": [
        {
          "name": "marketIndex",
          "type": "u8"
        },
        {
          "name": "trader",
          "type": "pubkey"
        }
      ]
    },
    {
      "name": "delegateAdvanced",
      "discriminator": [
        243,
        15,
        83,
        51,
        42,
        13,
        18,
        127
      ],
      "accounts": [
        {
          "name": "payer",
          "writable": true,
          "signer": true
        },
        {
          "name": "bufferAdvanced",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  98,
                  117,
                  102,
                  102,
                  101,
                  114
                ]
              },
              {
                "kind": "account",
                "path": "advanced"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                121,
                73,
                71,
                152,
                27,
                149,
                238,
                221,
                126,
                117,
                143,
                4,
                219,
                127,
                92,
                138,
                10,
                242,
                143,
                253,
                51,
                134,
                132,
                58,
                236,
                14,
                205,
                35,
                88,
                86,
                186,
                7
              ]
            }
          }
        },
        {
          "name": "delegationRecordAdvanced",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  100,
                  101,
                  108,
                  101,
                  103,
                  97,
                  116,
                  105,
                  111,
                  110
                ]
              },
              {
                "kind": "account",
                "path": "advanced"
              }
            ],
            "program": {
              "kind": "account",
              "path": "delegationProgram"
            }
          }
        },
        {
          "name": "delegationMetadataAdvanced",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  100,
                  101,
                  108,
                  101,
                  103,
                  97,
                  116,
                  105,
                  111,
                  110,
                  45,
                  109,
                  101,
                  116,
                  97,
                  100,
                  97,
                  116,
                  97
                ]
              },
              {
                "kind": "account",
                "path": "advanced"
              }
            ],
            "program": {
              "kind": "account",
              "path": "delegationProgram"
            }
          }
        },
        {
          "name": "advanced",
          "writable": true
        },
        {
          "name": "ownerProgram",
          "address": "9AT996FhU1n73PRDHLiQKZHBcwAPRiUVDSN71CgGso8S"
        },
        {
          "name": "delegationProgram",
          "address": "DELeGGvXpWV2fqJUhqcF5ZSYMS4JTLjteaAMARRSaeSh"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "marketIndex",
          "type": "u8"
        }
      ]
    },
    {
      "name": "delegateCollateral",
      "discriminator": [
        59,
        114,
        28,
        9,
        213,
        236,
        216,
        98
      ],
      "accounts": [
        {
          "name": "payer",
          "writable": true,
          "signer": true
        },
        {
          "name": "bufferCollateral",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  98,
                  117,
                  102,
                  102,
                  101,
                  114
                ]
              },
              {
                "kind": "account",
                "path": "collateral"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                121,
                73,
                71,
                152,
                27,
                149,
                238,
                221,
                126,
                117,
                143,
                4,
                219,
                127,
                92,
                138,
                10,
                242,
                143,
                253,
                51,
                134,
                132,
                58,
                236,
                14,
                205,
                35,
                88,
                86,
                186,
                7
              ]
            }
          }
        },
        {
          "name": "delegationRecordCollateral",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  100,
                  101,
                  108,
                  101,
                  103,
                  97,
                  116,
                  105,
                  111,
                  110
                ]
              },
              {
                "kind": "account",
                "path": "collateral"
              }
            ],
            "program": {
              "kind": "account",
              "path": "delegationProgram"
            }
          }
        },
        {
          "name": "delegationMetadataCollateral",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  100,
                  101,
                  108,
                  101,
                  103,
                  97,
                  116,
                  105,
                  111,
                  110,
                  45,
                  109,
                  101,
                  116,
                  97,
                  100,
                  97,
                  116,
                  97
                ]
              },
              {
                "kind": "account",
                "path": "collateral"
              }
            ],
            "program": {
              "kind": "account",
              "path": "delegationProgram"
            }
          }
        },
        {
          "name": "collateral",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  108,
                  108,
                  97,
                  116,
                  101,
                  114,
                  97,
                  108
                ]
              },
              {
                "kind": "account",
                "path": "payer"
              }
            ]
          }
        },
        {
          "name": "ownerProgram",
          "address": "9AT996FhU1n73PRDHLiQKZHBcwAPRiUVDSN71CgGso8S"
        },
        {
          "name": "delegationProgram",
          "address": "DELeGGvXpWV2fqJUhqcF5ZSYMS4JTLjteaAMARRSaeSh"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": []
    },
    {
      "name": "delegateFillLog",
      "discriminator": [
        135,
        31,
        53,
        27,
        23,
        166,
        24,
        248
      ],
      "accounts": [
        {
          "name": "payer",
          "writable": true,
          "signer": true
        },
        {
          "name": "bufferFillLog",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  98,
                  117,
                  102,
                  102,
                  101,
                  114
                ]
              },
              {
                "kind": "account",
                "path": "fillLog"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                121,
                73,
                71,
                152,
                27,
                149,
                238,
                221,
                126,
                117,
                143,
                4,
                219,
                127,
                92,
                138,
                10,
                242,
                143,
                253,
                51,
                134,
                132,
                58,
                236,
                14,
                205,
                35,
                88,
                86,
                186,
                7
              ]
            }
          }
        },
        {
          "name": "delegationRecordFillLog",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  100,
                  101,
                  108,
                  101,
                  103,
                  97,
                  116,
                  105,
                  111,
                  110
                ]
              },
              {
                "kind": "account",
                "path": "fillLog"
              }
            ],
            "program": {
              "kind": "account",
              "path": "delegationProgram"
            }
          }
        },
        {
          "name": "delegationMetadataFillLog",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  100,
                  101,
                  108,
                  101,
                  103,
                  97,
                  116,
                  105,
                  111,
                  110,
                  45,
                  109,
                  101,
                  116,
                  97,
                  100,
                  97,
                  116,
                  97
                ]
              },
              {
                "kind": "account",
                "path": "fillLog"
              }
            ],
            "program": {
              "kind": "account",
              "path": "delegationProgram"
            }
          }
        },
        {
          "name": "fillLog",
          "writable": true
        },
        {
          "name": "ownerProgram",
          "address": "9AT996FhU1n73PRDHLiQKZHBcwAPRiUVDSN71CgGso8S"
        },
        {
          "name": "delegationProgram",
          "address": "DELeGGvXpWV2fqJUhqcF5ZSYMS4JTLjteaAMARRSaeSh"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "marketIndex",
          "type": "u8"
        }
      ]
    },
    {
      "name": "delegateMargin",
      "discriminator": [
        221,
        32,
        81,
        169,
        148,
        71,
        176,
        48
      ],
      "accounts": [
        {
          "name": "payer",
          "writable": true,
          "signer": true
        },
        {
          "name": "bufferMarginProfile",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  98,
                  117,
                  102,
                  102,
                  101,
                  114
                ]
              },
              {
                "kind": "account",
                "path": "marginProfile"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                121,
                73,
                71,
                152,
                27,
                149,
                238,
                221,
                126,
                117,
                143,
                4,
                219,
                127,
                92,
                138,
                10,
                242,
                143,
                253,
                51,
                134,
                132,
                58,
                236,
                14,
                205,
                35,
                88,
                86,
                186,
                7
              ]
            }
          }
        },
        {
          "name": "delegationRecordMarginProfile",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  100,
                  101,
                  108,
                  101,
                  103,
                  97,
                  116,
                  105,
                  111,
                  110
                ]
              },
              {
                "kind": "account",
                "path": "marginProfile"
              }
            ],
            "program": {
              "kind": "account",
              "path": "delegationProgram"
            }
          }
        },
        {
          "name": "delegationMetadataMarginProfile",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  100,
                  101,
                  108,
                  101,
                  103,
                  97,
                  116,
                  105,
                  111,
                  110,
                  45,
                  109,
                  101,
                  116,
                  97,
                  100,
                  97,
                  116,
                  97
                ]
              },
              {
                "kind": "account",
                "path": "marginProfile"
              }
            ],
            "program": {
              "kind": "account",
              "path": "delegationProgram"
            }
          }
        },
        {
          "name": "marginProfile",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  109,
                  97,
                  114,
                  103,
                  105,
                  110
                ]
              },
              {
                "kind": "account",
                "path": "payer"
              }
            ]
          }
        },
        {
          "name": "ownerProgram",
          "address": "9AT996FhU1n73PRDHLiQKZHBcwAPRiUVDSN71CgGso8S"
        },
        {
          "name": "delegationProgram",
          "address": "DELeGGvXpWV2fqJUhqcF5ZSYMS4JTLjteaAMARRSaeSh"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": []
    },
    {
      "name": "delegateOrderbook",
      "discriminator": [
        137,
        87,
        39,
        254,
        172,
        199,
        4,
        183
      ],
      "accounts": [
        {
          "name": "payer",
          "writable": true,
          "signer": true
        },
        {
          "name": "bufferOrderbook",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  98,
                  117,
                  102,
                  102,
                  101,
                  114
                ]
              },
              {
                "kind": "account",
                "path": "orderbook"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                121,
                73,
                71,
                152,
                27,
                149,
                238,
                221,
                126,
                117,
                143,
                4,
                219,
                127,
                92,
                138,
                10,
                242,
                143,
                253,
                51,
                134,
                132,
                58,
                236,
                14,
                205,
                35,
                88,
                86,
                186,
                7
              ]
            }
          }
        },
        {
          "name": "delegationRecordOrderbook",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  100,
                  101,
                  108,
                  101,
                  103,
                  97,
                  116,
                  105,
                  111,
                  110
                ]
              },
              {
                "kind": "account",
                "path": "orderbook"
              }
            ],
            "program": {
              "kind": "account",
              "path": "delegationProgram"
            }
          }
        },
        {
          "name": "delegationMetadataOrderbook",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  100,
                  101,
                  108,
                  101,
                  103,
                  97,
                  116,
                  105,
                  111,
                  110,
                  45,
                  109,
                  101,
                  116,
                  97,
                  100,
                  97,
                  116,
                  97
                ]
              },
              {
                "kind": "account",
                "path": "orderbook"
              }
            ],
            "program": {
              "kind": "account",
              "path": "delegationProgram"
            }
          }
        },
        {
          "name": "orderbook",
          "writable": true
        },
        {
          "name": "ownerProgram",
          "address": "9AT996FhU1n73PRDHLiQKZHBcwAPRiUVDSN71CgGso8S"
        },
        {
          "name": "delegationProgram",
          "address": "DELeGGvXpWV2fqJUhqcF5ZSYMS4JTLjteaAMARRSaeSh"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "marketIndex",
          "type": "u8"
        }
      ]
    },
    {
      "name": "delegatePosition",
      "discriminator": [
        194,
        231,
        117,
        130,
        72,
        142,
        185,
        112
      ],
      "accounts": [
        {
          "name": "payer",
          "writable": true,
          "signer": true
        },
        {
          "name": "bufferPosition",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  98,
                  117,
                  102,
                  102,
                  101,
                  114
                ]
              },
              {
                "kind": "account",
                "path": "position"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                121,
                73,
                71,
                152,
                27,
                149,
                238,
                221,
                126,
                117,
                143,
                4,
                219,
                127,
                92,
                138,
                10,
                242,
                143,
                253,
                51,
                134,
                132,
                58,
                236,
                14,
                205,
                35,
                88,
                86,
                186,
                7
              ]
            }
          }
        },
        {
          "name": "delegationRecordPosition",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  100,
                  101,
                  108,
                  101,
                  103,
                  97,
                  116,
                  105,
                  111,
                  110
                ]
              },
              {
                "kind": "account",
                "path": "position"
              }
            ],
            "program": {
              "kind": "account",
              "path": "delegationProgram"
            }
          }
        },
        {
          "name": "delegationMetadataPosition",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  100,
                  101,
                  108,
                  101,
                  103,
                  97,
                  116,
                  105,
                  111,
                  110,
                  45,
                  109,
                  101,
                  116,
                  97,
                  100,
                  97,
                  116,
                  97
                ]
              },
              {
                "kind": "account",
                "path": "position"
              }
            ],
            "program": {
              "kind": "account",
              "path": "delegationProgram"
            }
          }
        },
        {
          "name": "position",
          "writable": true
        },
        {
          "name": "ownerProgram",
          "address": "9AT996FhU1n73PRDHLiQKZHBcwAPRiUVDSN71CgGso8S"
        },
        {
          "name": "delegationProgram",
          "address": "DELeGGvXpWV2fqJUhqcF5ZSYMS4JTLjteaAMARRSaeSh"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "marketIndex",
          "type": "u8"
        }
      ]
    },
    {
      "name": "delegatePriceFeed",
      "discriminator": [
        15,
        179,
        172,
        145,
        42,
        73,
        160,
        241
      ],
      "accounts": [
        {
          "name": "payer",
          "writable": true,
          "signer": true
        },
        {
          "name": "bufferPriceFeed",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  98,
                  117,
                  102,
                  102,
                  101,
                  114
                ]
              },
              {
                "kind": "account",
                "path": "priceFeed"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                121,
                73,
                71,
                152,
                27,
                149,
                238,
                221,
                126,
                117,
                143,
                4,
                219,
                127,
                92,
                138,
                10,
                242,
                143,
                253,
                51,
                134,
                132,
                58,
                236,
                14,
                205,
                35,
                88,
                86,
                186,
                7
              ]
            }
          }
        },
        {
          "name": "delegationRecordPriceFeed",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  100,
                  101,
                  108,
                  101,
                  103,
                  97,
                  116,
                  105,
                  111,
                  110
                ]
              },
              {
                "kind": "account",
                "path": "priceFeed"
              }
            ],
            "program": {
              "kind": "account",
              "path": "delegationProgram"
            }
          }
        },
        {
          "name": "delegationMetadataPriceFeed",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  100,
                  101,
                  108,
                  101,
                  103,
                  97,
                  116,
                  105,
                  111,
                  110,
                  45,
                  109,
                  101,
                  116,
                  97,
                  100,
                  97,
                  116,
                  97
                ]
              },
              {
                "kind": "account",
                "path": "priceFeed"
              }
            ],
            "program": {
              "kind": "account",
              "path": "delegationProgram"
            }
          }
        },
        {
          "name": "priceFeed",
          "writable": true
        },
        {
          "name": "ownerProgram",
          "address": "9AT996FhU1n73PRDHLiQKZHBcwAPRiUVDSN71CgGso8S"
        },
        {
          "name": "delegationProgram",
          "address": "DELeGGvXpWV2fqJUhqcF5ZSYMS4JTLjteaAMARRSaeSh"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "marketIndex",
          "type": "u8"
        }
      ]
    },
    {
      "name": "delegateRisk",
      "discriminator": [
        173,
        145,
        33,
        216,
        101,
        117,
        183,
        227
      ],
      "accounts": [
        {
          "name": "payer",
          "writable": true,
          "signer": true
        },
        {
          "name": "bufferRiskEngine",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  98,
                  117,
                  102,
                  102,
                  101,
                  114
                ]
              },
              {
                "kind": "account",
                "path": "riskEngine"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                121,
                73,
                71,
                152,
                27,
                149,
                238,
                221,
                126,
                117,
                143,
                4,
                219,
                127,
                92,
                138,
                10,
                242,
                143,
                253,
                51,
                134,
                132,
                58,
                236,
                14,
                205,
                35,
                88,
                86,
                186,
                7
              ]
            }
          }
        },
        {
          "name": "delegationRecordRiskEngine",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  100,
                  101,
                  108,
                  101,
                  103,
                  97,
                  116,
                  105,
                  111,
                  110
                ]
              },
              {
                "kind": "account",
                "path": "riskEngine"
              }
            ],
            "program": {
              "kind": "account",
              "path": "delegationProgram"
            }
          }
        },
        {
          "name": "delegationMetadataRiskEngine",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  100,
                  101,
                  108,
                  101,
                  103,
                  97,
                  116,
                  105,
                  111,
                  110,
                  45,
                  109,
                  101,
                  116,
                  97,
                  100,
                  97,
                  116,
                  97
                ]
              },
              {
                "kind": "account",
                "path": "riskEngine"
              }
            ],
            "program": {
              "kind": "account",
              "path": "delegationProgram"
            }
          }
        },
        {
          "name": "riskEngine",
          "writable": true
        },
        {
          "name": "ownerProgram",
          "address": "9AT996FhU1n73PRDHLiQKZHBcwAPRiUVDSN71CgGso8S"
        },
        {
          "name": "delegationProgram",
          "address": "DELeGGvXpWV2fqJUhqcF5ZSYMS4JTLjteaAMARRSaeSh"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "marketIndex",
          "type": "u8"
        }
      ]
    },
    {
      "name": "delegateTriggers",
      "discriminator": [
        83,
        104,
        222,
        136,
        154,
        179,
        32,
        23
      ],
      "accounts": [
        {
          "name": "payer",
          "writable": true,
          "signer": true
        },
        {
          "name": "bufferTriggers",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  98,
                  117,
                  102,
                  102,
                  101,
                  114
                ]
              },
              {
                "kind": "account",
                "path": "triggers"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                121,
                73,
                71,
                152,
                27,
                149,
                238,
                221,
                126,
                117,
                143,
                4,
                219,
                127,
                92,
                138,
                10,
                242,
                143,
                253,
                51,
                134,
                132,
                58,
                236,
                14,
                205,
                35,
                88,
                86,
                186,
                7
              ]
            }
          }
        },
        {
          "name": "delegationRecordTriggers",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  100,
                  101,
                  108,
                  101,
                  103,
                  97,
                  116,
                  105,
                  111,
                  110
                ]
              },
              {
                "kind": "account",
                "path": "triggers"
              }
            ],
            "program": {
              "kind": "account",
              "path": "delegationProgram"
            }
          }
        },
        {
          "name": "delegationMetadataTriggers",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  100,
                  101,
                  108,
                  101,
                  103,
                  97,
                  116,
                  105,
                  111,
                  110,
                  45,
                  109,
                  101,
                  116,
                  97,
                  100,
                  97,
                  116,
                  97
                ]
              },
              {
                "kind": "account",
                "path": "triggers"
              }
            ],
            "program": {
              "kind": "account",
              "path": "delegationProgram"
            }
          }
        },
        {
          "name": "triggers",
          "writable": true
        },
        {
          "name": "ownerProgram",
          "address": "9AT996FhU1n73PRDHLiQKZHBcwAPRiUVDSN71CgGso8S"
        },
        {
          "name": "delegationProgram",
          "address": "DELeGGvXpWV2fqJUhqcF5ZSYMS4JTLjteaAMARRSaeSh"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "marketIndex",
          "type": "u8"
        }
      ]
    },
    {
      "name": "depositCollateral",
      "discriminator": [
        156,
        131,
        142,
        116,
        146,
        247,
        162,
        120
      ],
      "accounts": [
        {
          "name": "user",
          "writable": true,
          "signer": true,
          "relations": [
            "collateral"
          ]
        },
        {
          "name": "collateral",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  108,
                  108,
                  97,
                  116,
                  101,
                  114,
                  97,
                  108
                ]
              },
              {
                "kind": "account",
                "path": "user"
              }
            ]
          }
        },
        {
          "name": "userTokenAccount",
          "writable": true
        },
        {
          "name": "vault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              }
            ]
          }
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        }
      ],
      "args": [
        {
          "name": "amount",
          "type": "u64"
        }
      ]
    },
    {
      "name": "initializeAdvanced",
      "discriminator": [
        170,
        200,
        41,
        175,
        162,
        130,
        55,
        118
      ],
      "accounts": [
        {
          "name": "user",
          "writable": true,
          "signer": true
        },
        {
          "name": "marketConfig"
        },
        {
          "name": "advanced",
          "writable": true
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "marketIndex",
          "type": "u8"
        }
      ]
    },
    {
      "name": "initializeCollateral",
      "discriminator": [
        5,
        185,
        112,
        16,
        169,
        75,
        193,
        165
      ],
      "accounts": [
        {
          "name": "user",
          "writable": true,
          "signer": true
        },
        {
          "name": "collateral",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  108,
                  108,
                  97,
                  116,
                  101,
                  114,
                  97,
                  108
                ]
              },
              {
                "kind": "account",
                "path": "user"
              }
            ]
          }
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": []
    },
    {
      "name": "initializeLeaderboard",
      "discriminator": [
        47,
        23,
        34,
        39,
        46,
        108,
        91,
        176
      ],
      "accounts": [
        {
          "name": "authority",
          "writable": true,
          "signer": true
        },
        {
          "name": "leaderboard",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  108,
                  101,
                  97,
                  100,
                  101,
                  114,
                  98,
                  111,
                  97,
                  114,
                  100
                ]
              }
            ]
          }
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "epochDuration",
          "type": "i64"
        },
        {
          "name": "seedPrize",
          "type": "u64"
        }
      ]
    },
    {
      "name": "initializeMarginProfile",
      "discriminator": [
        201,
        112,
        25,
        138,
        158,
        160,
        196,
        161
      ],
      "accounts": [
        {
          "name": "user",
          "writable": true,
          "signer": true
        },
        {
          "name": "marginProfile",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  109,
                  97,
                  114,
                  103,
                  105,
                  110
                ]
              },
              {
                "kind": "account",
                "path": "user"
              }
            ]
          }
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": []
    },
    {
      "name": "initializeMarket",
      "discriminator": [
        35,
        35,
        189,
        193,
        155,
        48,
        170,
        203
      ],
      "accounts": [
        {
          "name": "authority",
          "writable": true,
          "signer": true
        },
        {
          "name": "marketConfig",
          "writable": true
        },
        {
          "name": "orderbook",
          "writable": true
        },
        {
          "name": "fillLog",
          "writable": true
        },
        {
          "name": "priceFeed",
          "writable": true
        },
        {
          "name": "collateralMint"
        },
        {
          "name": "vault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              }
            ]
          }
        },
        {
          "name": "insuranceFund",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  105,
                  110,
                  115,
                  117,
                  114,
                  97,
                  110,
                  99,
                  101
                ]
              }
            ]
          }
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "marketIndex",
          "type": "u8"
        },
        {
          "name": "symbol",
          "type": "string"
        },
        {
          "name": "tickSize",
          "type": "u64"
        },
        {
          "name": "lotSize",
          "type": "u64"
        },
        {
          "name": "maxLeverage",
          "type": "u8"
        }
      ]
    },
    {
      "name": "initializePosition",
      "discriminator": [
        219,
        192,
        234,
        71,
        190,
        191,
        102,
        80
      ],
      "accounts": [
        {
          "name": "user",
          "writable": true,
          "signer": true
        },
        {
          "name": "marketConfig"
        },
        {
          "name": "position",
          "writable": true
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "marketIndex",
          "type": "u8"
        }
      ]
    },
    {
      "name": "initializeRisk",
      "discriminator": [
        33,
        40,
        94,
        55,
        126,
        254,
        234,
        196
      ],
      "accounts": [
        {
          "name": "authority",
          "writable": true,
          "signer": true
        },
        {
          "name": "marketConfig"
        },
        {
          "name": "riskEngine",
          "writable": true
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "marketIndex",
          "type": "u8"
        }
      ]
    },
    {
      "name": "initializeTriggers",
      "discriminator": [
        200,
        243,
        0,
        243,
        214,
        200,
        210,
        197
      ],
      "accounts": [
        {
          "name": "user",
          "writable": true,
          "signer": true
        },
        {
          "name": "marketConfig"
        },
        {
          "name": "triggers",
          "writable": true
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "marketIndex",
          "type": "u8"
        }
      ]
    },
    {
      "name": "liquidate",
      "discriminator": [
        223,
        179,
        226,
        125,
        48,
        46,
        39,
        74
      ],
      "accounts": [
        {
          "name": "liquidator",
          "signer": true
        },
        {
          "name": "marketConfig"
        },
        {
          "name": "priceFeed"
        },
        {
          "name": "orderbook",
          "writable": true
        },
        {
          "name": "fillLog",
          "writable": true
        },
        {
          "name": "traderPosition",
          "writable": true
        },
        {
          "name": "traderCollateral",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  108,
                  108,
                  97,
                  116,
                  101,
                  114,
                  97,
                  108
                ]
              },
              {
                "kind": "arg",
                "path": "trader"
              }
            ]
          }
        },
        {
          "name": "liquidatorCollateral",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  108,
                  108,
                  97,
                  116,
                  101,
                  114,
                  97,
                  108
                ]
              },
              {
                "kind": "account",
                "path": "liquidator"
              }
            ]
          }
        }
      ],
      "args": [
        {
          "name": "marketIndex",
          "type": "u8"
        },
        {
          "name": "trader",
          "type": "pubkey"
        }
      ]
    },
    {
      "name": "liquidatePartial",
      "discriminator": [
        225,
        90,
        199,
        26,
        130,
        43,
        146,
        157
      ],
      "accounts": [
        {
          "name": "liquidator",
          "signer": true
        },
        {
          "name": "marketConfig"
        },
        {
          "name": "priceFeed"
        },
        {
          "name": "orderbook",
          "writable": true
        },
        {
          "name": "fillLog",
          "writable": true
        },
        {
          "name": "traderPosition",
          "writable": true
        },
        {
          "name": "traderCollateral",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  108,
                  108,
                  97,
                  116,
                  101,
                  114,
                  97,
                  108
                ]
              },
              {
                "kind": "arg",
                "path": "trader"
              }
            ]
          }
        },
        {
          "name": "liquidatorCollateral",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  108,
                  108,
                  97,
                  116,
                  101,
                  114,
                  97,
                  108
                ]
              },
              {
                "kind": "account",
                "path": "liquidator"
              }
            ]
          }
        }
      ],
      "args": [
        {
          "name": "marketIndex",
          "type": "u8"
        },
        {
          "name": "trader",
          "type": "pubkey"
        }
      ]
    },
    {
      "name": "placeAdvancedOrder",
      "discriminator": [
        154,
        232,
        21,
        192,
        65,
        206,
        117,
        105
      ],
      "accounts": [
        {
          "name": "user",
          "signer": true
        },
        {
          "name": "marketConfig"
        },
        {
          "name": "orderbook",
          "writable": true
        },
        {
          "name": "advanced",
          "writable": true
        },
        {
          "name": "collateral",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  108,
                  108,
                  97,
                  116,
                  101,
                  114,
                  97,
                  108
                ]
              },
              {
                "kind": "account",
                "path": "user"
              }
            ]
          }
        },
        {
          "name": "riskEngine",
          "optional": true
        }
      ],
      "args": [
        {
          "name": "marketIndex",
          "type": "u8"
        },
        {
          "name": "side",
          "type": {
            "defined": {
              "name": "side"
            }
          }
        },
        {
          "name": "price",
          "type": "u64"
        },
        {
          "name": "totalSize",
          "type": "u64"
        },
        {
          "name": "displaySize",
          "type": "u64"
        },
        {
          "name": "sliceInterval",
          "type": "i64"
        },
        {
          "name": "expiryTs",
          "type": "i64"
        },
        {
          "name": "kind",
          "type": {
            "defined": {
              "name": "advOrderKind"
            }
          }
        }
      ]
    },
    {
      "name": "placeOrder",
      "discriminator": [
        51,
        194,
        155,
        175,
        109,
        130,
        96,
        106
      ],
      "accounts": [
        {
          "name": "taker",
          "signer": true
        },
        {
          "name": "marketConfig"
        },
        {
          "name": "orderbook",
          "writable": true
        },
        {
          "name": "fillLog",
          "writable": true
        },
        {
          "name": "takerPosition",
          "writable": true
        },
        {
          "name": "takerCollateral",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  108,
                  108,
                  97,
                  116,
                  101,
                  114,
                  97,
                  108
                ]
              },
              {
                "kind": "account",
                "path": "taker"
              }
            ]
          }
        },
        {
          "name": "riskEngine",
          "optional": true
        },
        {
          "name": "marginProfile",
          "optional": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  109,
                  97,
                  114,
                  103,
                  105,
                  110
                ]
              },
              {
                "kind": "account",
                "path": "taker"
              }
            ]
          }
        }
      ],
      "args": [
        {
          "name": "marketIndex",
          "type": "u8"
        },
        {
          "name": "side",
          "type": {
            "defined": {
              "name": "side"
            }
          }
        },
        {
          "name": "price",
          "type": "u64"
        },
        {
          "name": "size",
          "type": "u64"
        },
        {
          "name": "orderType",
          "type": {
            "defined": {
              "name": "orderType"
            }
          }
        }
      ]
    },
    {
      "name": "placeTrigger",
      "discriminator": [
        219,
        75,
        198,
        172,
        87,
        232,
        205,
        21
      ],
      "accounts": [
        {
          "name": "user",
          "signer": true
        },
        {
          "name": "triggers",
          "writable": true
        }
      ],
      "args": [
        {
          "name": "marketIndex",
          "type": "u8"
        },
        {
          "name": "kind",
          "type": {
            "defined": {
              "name": "triggerKind"
            }
          }
        },
        {
          "name": "triggerPrice",
          "type": "u64"
        },
        {
          "name": "size",
          "type": "u64"
        },
        {
          "name": "fireSide",
          "type": {
            "defined": {
              "name": "side"
            }
          }
        }
      ]
    },
    {
      "name": "processUndelegation",
      "discriminator": [
        196,
        28,
        41,
        206,
        48,
        37,
        51,
        167
      ],
      "accounts": [
        {
          "name": "baseAccount",
          "writable": true
        },
        {
          "name": "buffer"
        },
        {
          "name": "payer",
          "writable": true
        },
        {
          "name": "systemProgram"
        }
      ],
      "args": [
        {
          "name": "accountSeeds",
          "type": {
            "vec": "bytes"
          }
        }
      ]
    },
    {
      "name": "pushPrice",
      "discriminator": [
        113,
        238,
        232,
        235,
        60,
        71,
        127,
        203
      ],
      "accounts": [
        {
          "name": "publisher",
          "signer": true
        },
        {
          "name": "priceFeed",
          "writable": true
        }
      ],
      "args": [
        {
          "name": "marketIndex",
          "type": "u8"
        },
        {
          "name": "mark",
          "type": "u64"
        },
        {
          "name": "index",
          "type": "u64"
        }
      ]
    },
    {
      "name": "reapExpired",
      "discriminator": [
        240,
        25,
        138,
        191,
        100,
        97,
        170,
        220
      ],
      "accounts": [
        {
          "name": "cranker",
          "signer": true
        },
        {
          "name": "orderbook",
          "writable": true
        },
        {
          "name": "advanced",
          "writable": true
        }
      ],
      "args": [
        {
          "name": "marketIndex",
          "type": "u8"
        },
        {
          "name": "trader",
          "type": "pubkey"
        }
      ]
    },
    {
      "name": "requestTournamentWinner",
      "discriminator": [
        107,
        44,
        190,
        167,
        100,
        91,
        34,
        29
      ],
      "accounts": [
        {
          "name": "payer",
          "writable": true,
          "signer": true
        },
        {
          "name": "leaderboard",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  108,
                  101,
                  97,
                  100,
                  101,
                  114,
                  98,
                  111,
                  97,
                  114,
                  100
                ]
              }
            ]
          }
        },
        {
          "name": "programIdentity",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  105,
                  100,
                  101,
                  110,
                  116,
                  105,
                  116,
                  121
                ]
              }
            ]
          }
        },
        {
          "name": "vrfProgram"
        },
        {
          "name": "oracleQueue",
          "writable": true
        },
        {
          "name": "slotHashes",
          "address": "SysvarS1otHashes111111111111111111111111111"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": []
    },
    {
      "name": "resetLeaderboard",
      "discriminator": [
        25,
        8,
        195,
        1,
        92,
        28,
        78,
        236
      ],
      "accounts": [
        {
          "name": "authority",
          "signer": true
        },
        {
          "name": "leaderboard",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  108,
                  101,
                  97,
                  100,
                  101,
                  114,
                  98,
                  111,
                  97,
                  114,
                  100
                ]
              }
            ]
          }
        }
      ],
      "args": [
        {
          "name": "epochDuration",
          "type": "i64"
        },
        {
          "name": "seedPrize",
          "type": "u64"
        }
      ]
    },
    {
      "name": "resetOrderbook",
      "discriminator": [
        38,
        191,
        180,
        119,
        42,
        3,
        16,
        242
      ],
      "accounts": [
        {
          "name": "authority",
          "signer": true
        },
        {
          "name": "marketConfig"
        },
        {
          "name": "orderbook",
          "writable": true
        }
      ],
      "args": [
        {
          "name": "marketIndex",
          "type": "u8"
        }
      ]
    },
    {
      "name": "resetRisk",
      "discriminator": [
        156,
        187,
        24,
        232,
        96,
        38,
        68,
        156
      ],
      "accounts": [
        {
          "name": "authority",
          "signer": true
        },
        {
          "name": "marketConfig"
        },
        {
          "name": "riskEngine",
          "writable": true
        }
      ],
      "args": [
        {
          "name": "marketIndex",
          "type": "u8"
        }
      ]
    },
    {
      "name": "reversePosition",
      "discriminator": [
        242,
        155,
        136,
        35,
        118,
        199,
        172,
        130
      ],
      "accounts": [
        {
          "name": "taker",
          "signer": true
        },
        {
          "name": "marketConfig"
        },
        {
          "name": "orderbook",
          "writable": true
        },
        {
          "name": "fillLog",
          "writable": true
        },
        {
          "name": "takerPosition",
          "writable": true
        },
        {
          "name": "takerCollateral",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  108,
                  108,
                  97,
                  116,
                  101,
                  114,
                  97,
                  108
                ]
              },
              {
                "kind": "account",
                "path": "taker"
              }
            ]
          }
        }
      ],
      "args": [
        {
          "name": "marketIndex",
          "type": "u8"
        }
      ]
    },
    {
      "name": "scaleInOut",
      "discriminator": [
        42,
        53,
        164,
        56,
        151,
        80,
        29,
        136
      ],
      "accounts": [
        {
          "name": "taker",
          "signer": true
        },
        {
          "name": "marketConfig"
        },
        {
          "name": "orderbook",
          "writable": true
        },
        {
          "name": "fillLog",
          "writable": true
        },
        {
          "name": "takerPosition",
          "writable": true
        },
        {
          "name": "takerCollateral",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  108,
                  108,
                  97,
                  116,
                  101,
                  114,
                  97,
                  108
                ]
              },
              {
                "kind": "account",
                "path": "taker"
              }
            ]
          }
        }
      ],
      "args": [
        {
          "name": "marketIndex",
          "type": "u8"
        },
        {
          "name": "pct",
          "type": "u16"
        },
        {
          "name": "increase",
          "type": "bool"
        }
      ]
    },
    {
      "name": "setFundingTs",
      "discriminator": [
        228,
        137,
        74,
        39,
        31,
        227,
        9,
        160
      ],
      "accounts": [
        {
          "name": "authority",
          "signer": true
        },
        {
          "name": "marketConfig"
        },
        {
          "name": "orderbook",
          "writable": true
        }
      ],
      "args": [
        {
          "name": "marketIndex",
          "type": "u8"
        },
        {
          "name": "ts",
          "type": "i64"
        }
      ]
    },
    {
      "name": "settleToL1",
      "discriminator": [
        93,
        122,
        202,
        230,
        165,
        134,
        87,
        64
      ],
      "accounts": [
        {
          "name": "insuranceFund",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  105,
                  110,
                  115,
                  117,
                  114,
                  97,
                  110,
                  99,
                  101
                ]
              }
            ]
          }
        },
        {
          "name": "escrowAuth"
        },
        {
          "name": "escrow"
        }
      ],
      "args": [
        {
          "name": "insuranceDelta",
          "type": "u64"
        },
        {
          "name": "protocolDelta",
          "type": "u64"
        }
      ]
    },
    {
      "name": "settleTournament",
      "discriminator": [
        106,
        1,
        252,
        206,
        251,
        192,
        194,
        84
      ],
      "accounts": [
        {
          "name": "vrfProgramIdentity",
          "signer": true,
          "address": "HJ8cHvHetwhFk5SuZv9pCYKyserK6NJsQ8vUj8zaiLdY"
        },
        {
          "name": "leaderboard",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  108,
                  101,
                  97,
                  100,
                  101,
                  114,
                  98,
                  111,
                  97,
                  114,
                  100
                ]
              }
            ]
          }
        }
      ],
      "args": [
        {
          "name": "randomness",
          "type": {
            "array": [
              "u8",
              32
            ]
          }
        }
      ]
    },
    {
      "name": "settleTournamentDemo",
      "discriminator": [
        225,
        104,
        119,
        239,
        76,
        170,
        134,
        215
      ],
      "accounts": [
        {
          "name": "authority",
          "signer": true
        },
        {
          "name": "leaderboard",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  108,
                  101,
                  97,
                  100,
                  101,
                  114,
                  98,
                  111,
                  97,
                  114,
                  100
                ]
              }
            ]
          }
        },
        {
          "name": "slotHashes",
          "address": "SysvarS1otHashes111111111111111111111111111"
        }
      ],
      "args": []
    },
    {
      "name": "socializeLoss",
      "discriminator": [
        245,
        75,
        91,
        0,
        236,
        97,
        19,
        3
      ],
      "accounts": [
        {
          "name": "cranker",
          "signer": true
        },
        {
          "name": "insuranceFund",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  105,
                  110,
                  115,
                  117,
                  114,
                  97,
                  110,
                  99,
                  101
                ]
              }
            ]
          }
        }
      ],
      "args": [
        {
          "name": "marketIndex",
          "type": "u8"
        },
        {
          "name": "badDebt",
          "type": "u64"
        }
      ]
    },
    {
      "name": "undelegateUser",
      "discriminator": [
        116,
        139,
        246,
        224,
        235,
        172,
        97,
        25
      ],
      "accounts": [
        {
          "name": "user",
          "writable": true,
          "signer": true
        },
        {
          "name": "collateral",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  108,
                  108,
                  97,
                  116,
                  101,
                  114,
                  97,
                  108
                ]
              },
              {
                "kind": "account",
                "path": "user"
              }
            ]
          }
        },
        {
          "name": "position",
          "writable": true
        },
        {
          "name": "triggers",
          "writable": true
        },
        {
          "name": "magicProgram",
          "address": "Magic11111111111111111111111111111111111111"
        },
        {
          "name": "magicContext",
          "writable": true,
          "address": "MagicContext1111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "marketIndex",
          "type": "u8"
        }
      ]
    },
    {
      "name": "updateLeaderboard",
      "discriminator": [
        72,
        95,
        102,
        32,
        118,
        158,
        247,
        34
      ],
      "accounts": [
        {
          "name": "cranker",
          "signer": true
        },
        {
          "name": "leaderboard",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  108,
                  101,
                  97,
                  100,
                  101,
                  114,
                  98,
                  111,
                  97,
                  114,
                  100
                ]
              }
            ]
          }
        }
      ],
      "args": [
        {
          "name": "trader",
          "type": "pubkey"
        },
        {
          "name": "pnlBps",
          "type": "i64"
        },
        {
          "name": "realizedPnl",
          "type": "i64"
        },
        {
          "name": "volume",
          "type": "u64"
        }
      ]
    },
    {
      "name": "updateMarginProfile",
      "discriminator": [
        227,
        60,
        6,
        108,
        150,
        110,
        45,
        152
      ],
      "accounts": [
        {
          "name": "cranker",
          "signer": true
        },
        {
          "name": "marginProfile",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  109,
                  97,
                  114,
                  103,
                  105,
                  110
                ]
              },
              {
                "kind": "account",
                "path": "margin_profile.user",
                "account": "marginProfile"
              }
            ]
          }
        }
      ],
      "args": []
    },
    {
      "name": "updateRisk",
      "discriminator": [
        35,
        23,
        4,
        153,
        221,
        230,
        11,
        16
      ],
      "accounts": [
        {
          "name": "cranker",
          "signer": true
        },
        {
          "name": "priceFeed"
        },
        {
          "name": "riskEngine",
          "writable": true
        }
      ],
      "args": [
        {
          "name": "marketIndex",
          "type": "u8"
        }
      ]
    },
    {
      "name": "withdrawCollateral",
      "discriminator": [
        115,
        135,
        168,
        106,
        139,
        214,
        138,
        150
      ],
      "accounts": [
        {
          "name": "user",
          "writable": true,
          "signer": true,
          "relations": [
            "collateral"
          ]
        },
        {
          "name": "collateral",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  108,
                  108,
                  97,
                  116,
                  101,
                  114,
                  97,
                  108
                ]
              },
              {
                "kind": "account",
                "path": "user"
              }
            ]
          }
        },
        {
          "name": "userTokenAccount",
          "writable": true
        },
        {
          "name": "vault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              }
            ]
          }
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        }
      ],
      "args": [
        {
          "name": "amount",
          "type": "u64"
        }
      ]
    }
  ],
  "accounts": [
    {
      "name": "advancedOrders",
      "discriminator": [
        70,
        105,
        24,
        57,
        29,
        58,
        174,
        229
      ]
    },
    {
      "name": "collateralAccount",
      "discriminator": [
        134,
        2,
        192,
        39,
        194,
        239,
        19,
        17
      ]
    },
    {
      "name": "fillLog",
      "discriminator": [
        117,
        168,
        16,
        123,
        102,
        249,
        153,
        9
      ]
    },
    {
      "name": "insuranceFund",
      "discriminator": [
        43,
        134,
        170,
        87,
        102,
        16,
        142,
        147
      ]
    },
    {
      "name": "leaderboard",
      "discriminator": [
        247,
        186,
        238,
        243,
        194,
        30,
        9,
        36
      ]
    },
    {
      "name": "marginProfile",
      "discriminator": [
        92,
        18,
        122,
        114,
        45,
        120,
        212,
        39
      ]
    },
    {
      "name": "marketConfig",
      "discriminator": [
        119,
        255,
        200,
        88,
        252,
        82,
        128,
        24
      ]
    },
    {
      "name": "orderbookState",
      "discriminator": [
        150,
        112,
        63,
        68,
        126,
        10,
        73,
        129
      ]
    },
    {
      "name": "positionAccount",
      "discriminator": [
        60,
        125,
        250,
        193,
        181,
        109,
        238,
        86
      ]
    },
    {
      "name": "priceFeed",
      "discriminator": [
        189,
        103,
        252,
        23,
        152,
        35,
        243,
        156
      ]
    },
    {
      "name": "riskEngine",
      "discriminator": [
        19,
        58,
        108,
        189,
        125,
        121,
        67,
        120
      ]
    },
    {
      "name": "triggerOrders",
      "discriminator": [
        144,
        239,
        29,
        11,
        191,
        46,
        213,
        27
      ]
    }
  ],
  "events": [
    {
      "name": "adlEvent",
      "discriminator": [
        134,
        177,
        155,
        43,
        202,
        133,
        243,
        204
      ]
    },
    {
      "name": "advancedReaped",
      "discriminator": [
        223,
        189,
        184,
        212,
        92,
        178,
        226,
        28
      ]
    },
    {
      "name": "advancedSlice",
      "discriminator": [
        151,
        175,
        141,
        227,
        46,
        136,
        8,
        156
      ]
    },
    {
      "name": "fillEvent",
      "discriminator": [
        13,
        89,
        41,
        228,
        105,
        178,
        45,
        112
      ]
    },
    {
      "name": "fundingApplied",
      "discriminator": [
        194,
        179,
        74,
        74,
        126,
        67,
        154,
        104
      ]
    },
    {
      "name": "leaderboardUpdated",
      "discriminator": [
        28,
        209,
        133,
        1,
        229,
        195,
        230,
        228
      ]
    },
    {
      "name": "liquidationEvent",
      "discriminator": [
        3,
        13,
        21,
        93,
        173,
        136,
        72,
        144
      ]
    },
    {
      "name": "marginProfileUpdated",
      "discriminator": [
        65,
        181,
        205,
        56,
        136,
        34,
        180,
        140
      ]
    },
    {
      "name": "partialLiquidationEvent",
      "discriminator": [
        81,
        69,
        168,
        241,
        146,
        183,
        143,
        196
      ]
    },
    {
      "name": "riskUpdated",
      "discriminator": [
        87,
        30,
        13,
        133,
        134,
        140,
        42,
        47
      ]
    },
    {
      "name": "socializedLossEvent",
      "discriminator": [
        54,
        185,
        209,
        22,
        70,
        34,
        34,
        89
      ]
    },
    {
      "name": "tournamentRequested",
      "discriminator": [
        199,
        179,
        45,
        92,
        78,
        98,
        192,
        91
      ]
    },
    {
      "name": "tournamentSettled",
      "discriminator": [
        205,
        249,
        139,
        94,
        146,
        110,
        167,
        235
      ]
    },
    {
      "name": "triggerFired",
      "discriminator": [
        98,
        81,
        57,
        42,
        194,
        143,
        38,
        50
      ]
    }
  ],
  "errors": [
    {
      "code": 6000,
      "name": "unauthorized",
      "msg": "Caller is not the required authority"
    },
    {
      "code": 6001,
      "name": "publisherMismatch",
      "msg": "Publisher does not match the price feed publisher"
    },
    {
      "code": 6002,
      "name": "makerAccountMismatch",
      "msg": "Maker account does not match the resting order owner"
    },
    {
      "code": 6003,
      "name": "orderOwnerMismatch",
      "msg": "Order is not owned by the caller"
    },
    {
      "code": 6004,
      "name": "invalidMarketIndex",
      "msg": "Invalid market index"
    },
    {
      "code": 6005,
      "name": "marketMismatch",
      "msg": "Account does not belong to this market"
    },
    {
      "code": 6006,
      "name": "missingAccount",
      "msg": "Account is missing from remaining_accounts"
    },
    {
      "code": 6007,
      "name": "sizeBelowLot",
      "msg": "Order size is below the market lot size"
    },
    {
      "code": 6008,
      "name": "sizeNotAligned",
      "msg": "Size must be a multiple of the lot size"
    },
    {
      "code": 6009,
      "name": "priceNotAligned",
      "msg": "Price is not a multiple of the tick size"
    },
    {
      "code": 6010,
      "name": "invalidPrice",
      "msg": "Price must be non-zero for a limit order"
    },
    {
      "code": 6011,
      "name": "invalidLeverage",
      "msg": "Leverage exceeds the market maximum"
    },
    {
      "code": 6012,
      "name": "insufficientMargin",
      "msg": "Insufficient available margin for this order"
    },
    {
      "code": 6013,
      "name": "noLiquidity",
      "msg": "Market order found no liquidity"
    },
    {
      "code": 6014,
      "name": "orderbookFull",
      "msg": "Orderbook side is at capacity"
    },
    {
      "code": 6015,
      "name": "orderNotFound",
      "msg": "Order id not found in the book"
    },
    {
      "code": 6016,
      "name": "triggersFull",
      "msg": "Trigger list is at capacity"
    },
    {
      "code": 6017,
      "name": "triggerNotFound",
      "msg": "Trigger not found"
    },
    {
      "code": 6018,
      "name": "noTriggersFired",
      "msg": "No triggers crossed the current price"
    },
    {
      "code": 6019,
      "name": "notLiquidatable",
      "msg": "Position health is above the maintenance margin; not liquidatable"
    },
    {
      "code": 6020,
      "name": "noOpenPosition",
      "msg": "Position is flat; nothing to liquidate or close"
    },
    {
      "code": 6021,
      "name": "fundingNotDue",
      "msg": "Funding interval has not elapsed yet"
    },
    {
      "code": 6022,
      "name": "invalidAmount",
      "msg": "Deposit/withdraw amount must be non-zero"
    },
    {
      "code": 6023,
      "name": "insufficientFunds",
      "msg": "Withdraw amount exceeds available margin"
    },
    {
      "code": 6024,
      "name": "accountStillDelegated",
      "msg": "Account must be undelegated before this operation"
    },
    {
      "code": 6025,
      "name": "openPositionsExist",
      "msg": "Cannot withdraw while positions are open"
    },
    {
      "code": 6026,
      "name": "openOrdersExist",
      "msg": "Cannot withdraw while orders are resting"
    },
    {
      "code": 6027,
      "name": "epochNotEnded",
      "msg": "Tournament epoch has not ended yet"
    },
    {
      "code": 6028,
      "name": "vrfAlreadyPending",
      "msg": "A VRF request is already in flight"
    },
    {
      "code": 6029,
      "name": "noVrfPending",
      "msg": "No VRF request is pending"
    },
    {
      "code": 6030,
      "name": "noCandidates",
      "msg": "No profitable participants to draw from"
    },
    {
      "code": 6031,
      "name": "winnerMismatch",
      "msg": "Winner account does not match the drawn candidate"
    },
    {
      "code": 6032,
      "name": "mathOverflow",
      "msg": "Arithmetic overflow"
    },
    {
      "code": 6033,
      "name": "capacityExceeded",
      "msg": "Account capacity exceeded"
    }
  ],
  "types": [
    {
      "name": "adlEvent",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "marketIndex",
            "type": "u8"
          },
          {
            "name": "counterparty",
            "type": "pubkey"
          },
          {
            "name": "bankruptcyPrice",
            "type": "u64"
          },
          {
            "name": "closedSize",
            "type": "u64"
          },
          {
            "name": "settledPnl",
            "type": "i64"
          },
          {
            "name": "ts",
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "advOrderKind",
      "type": {
        "kind": "enum",
        "variants": [
          {
            "name": "iceberg"
          },
          {
            "name": "twap"
          },
          {
            "name": "gtt"
          }
        ]
      }
    },
    {
      "name": "advancedOrder",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "id",
            "type": "u64"
          },
          {
            "name": "kind",
            "type": {
              "defined": {
                "name": "advOrderKind"
              }
            }
          },
          {
            "name": "side",
            "type": {
              "defined": {
                "name": "side"
              }
            }
          },
          {
            "name": "price",
            "type": "u64"
          },
          {
            "name": "totalSize",
            "type": "u64"
          },
          {
            "name": "filled",
            "type": "u64"
          },
          {
            "name": "displaySize",
            "type": "u64"
          },
          {
            "name": "sliceInterval",
            "type": "i64"
          },
          {
            "name": "expiryTs",
            "type": "i64"
          },
          {
            "name": "lastSliceTs",
            "type": "i64"
          },
          {
            "name": "restingOrderId",
            "type": "u64"
          },
          {
            "name": "restingSize",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "advancedOrders",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "user",
            "type": "pubkey"
          },
          {
            "name": "marketIndex",
            "type": "u8"
          },
          {
            "name": "orders",
            "type": {
              "vec": {
                "defined": {
                  "name": "advancedOrder"
                }
              }
            }
          },
          {
            "name": "nextAdvId",
            "type": "u64"
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "advancedReaped",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "marketIndex",
            "type": "u8"
          },
          {
            "name": "user",
            "type": "pubkey"
          },
          {
            "name": "advId",
            "type": "u64"
          },
          {
            "name": "ts",
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "advancedSlice",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "marketIndex",
            "type": "u8"
          },
          {
            "name": "user",
            "type": "pubkey"
          },
          {
            "name": "advId",
            "type": "u64"
          },
          {
            "name": "kind",
            "type": {
              "defined": {
                "name": "advOrderKind"
              }
            }
          },
          {
            "name": "sliceSize",
            "type": "u64"
          },
          {
            "name": "filled",
            "type": "u64"
          },
          {
            "name": "totalSize",
            "type": "u64"
          },
          {
            "name": "restingOrderId",
            "type": "u64"
          },
          {
            "name": "ts",
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "collateralAccount",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "user",
            "type": "pubkey"
          },
          {
            "name": "deposited",
            "type": "u64"
          },
          {
            "name": "availableMargin",
            "type": "u64"
          },
          {
            "name": "marginUsed",
            "type": "u64"
          },
          {
            "name": "realizedPnl",
            "type": "i64"
          },
          {
            "name": "feesPaid",
            "type": "i64"
          },
          {
            "name": "fundingPaid",
            "type": "i64"
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "fill",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "maker",
            "type": "pubkey"
          },
          {
            "name": "taker",
            "type": "pubkey"
          },
          {
            "name": "price",
            "type": "u64"
          },
          {
            "name": "size",
            "type": "u64"
          },
          {
            "name": "takerSide",
            "type": {
              "defined": {
                "name": "side"
              }
            }
          },
          {
            "name": "ts",
            "type": "i64"
          },
          {
            "name": "sequence",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "fillEvent",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "marketIndex",
            "type": "u8"
          },
          {
            "name": "maker",
            "type": "pubkey"
          },
          {
            "name": "taker",
            "type": "pubkey"
          },
          {
            "name": "price",
            "type": "u64"
          },
          {
            "name": "size",
            "type": "u64"
          },
          {
            "name": "takerSide",
            "type": {
              "defined": {
                "name": "side"
              }
            }
          },
          {
            "name": "sequence",
            "type": "u64"
          },
          {
            "name": "ts",
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "fillLog",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "marketIndex",
            "type": "u8"
          },
          {
            "name": "fills",
            "type": {
              "vec": {
                "defined": {
                  "name": "fill"
                }
              }
            }
          },
          {
            "name": "head",
            "type": "u16"
          },
          {
            "name": "count",
            "type": "u16"
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "fundingApplied",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "marketIndex",
            "type": "u8"
          },
          {
            "name": "fundingRateBps",
            "type": "i64"
          },
          {
            "name": "markPrice",
            "type": "u64"
          },
          {
            "name": "indexPrice",
            "type": "u64"
          },
          {
            "name": "ts",
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "insuranceFund",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "balance",
            "type": "u64"
          },
          {
            "name": "badDebtAbsorbed",
            "type": "u64"
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "leaderEntry",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "trader",
            "type": "pubkey"
          },
          {
            "name": "pnlBps",
            "type": "i64"
          },
          {
            "name": "realizedPnl",
            "type": "i64"
          },
          {
            "name": "volume",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "leaderboard",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "authority",
            "type": "pubkey"
          },
          {
            "name": "epoch",
            "type": "u64"
          },
          {
            "name": "startTs",
            "type": "i64"
          },
          {
            "name": "endTs",
            "type": "i64"
          },
          {
            "name": "epochDuration",
            "type": "i64"
          },
          {
            "name": "prizePool",
            "type": "u64"
          },
          {
            "name": "entries",
            "type": {
              "vec": {
                "defined": {
                  "name": "leaderEntry"
                }
              }
            }
          },
          {
            "name": "candidates",
            "type": {
              "vec": "pubkey"
            }
          },
          {
            "name": "vrfPending",
            "type": "bool"
          },
          {
            "name": "winner",
            "type": "pubkey"
          },
          {
            "name": "vrfResult",
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "history",
            "type": {
              "vec": {
                "defined": {
                  "name": "winnerRecord"
                }
              }
            }
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "leaderboardUpdated",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "epoch",
            "type": "u64"
          },
          {
            "name": "trader",
            "type": "pubkey"
          },
          {
            "name": "pnlBps",
            "type": "i64"
          },
          {
            "name": "rank",
            "type": "u8"
          },
          {
            "name": "prizePool",
            "type": "u64"
          },
          {
            "name": "ts",
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "liquidationEvent",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "marketIndex",
            "type": "u8"
          },
          {
            "name": "trader",
            "type": "pubkey"
          },
          {
            "name": "liquidator",
            "type": "pubkey"
          },
          {
            "name": "closedSize",
            "type": "u64"
          },
          {
            "name": "closedNotional",
            "type": "u64"
          },
          {
            "name": "liquidationFee",
            "type": "u64"
          },
          {
            "name": "liquidatorBounty",
            "type": "u64"
          },
          {
            "name": "insuranceShare",
            "type": "u64"
          },
          {
            "name": "badDebt",
            "type": "u64"
          },
          {
            "name": "ts",
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "marginLeg",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "marketIndex",
            "type": "u8"
          },
          {
            "name": "side",
            "type": {
              "defined": {
                "name": "positionSide"
              }
            }
          },
          {
            "name": "notional",
            "type": "u64"
          },
          {
            "name": "margin",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "marginProfile",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "user",
            "type": "pubkey"
          },
          {
            "name": "legs",
            "type": {
              "vec": {
                "defined": {
                  "name": "marginLeg"
                }
              }
            }
          },
          {
            "name": "grossNotional",
            "type": "u64"
          },
          {
            "name": "netNotional",
            "type": "u64"
          },
          {
            "name": "marginNaive",
            "type": "u64"
          },
          {
            "name": "marginRequired",
            "type": "u64"
          },
          {
            "name": "marginSaved",
            "type": "u64"
          },
          {
            "name": "netSide",
            "type": {
              "defined": {
                "name": "positionSide"
              }
            }
          },
          {
            "name": "lastUpdateTs",
            "type": "i64"
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "marginProfileUpdated",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "user",
            "type": "pubkey"
          },
          {
            "name": "grossNotional",
            "type": "u64"
          },
          {
            "name": "netNotional",
            "type": "u64"
          },
          {
            "name": "marginNaive",
            "type": "u64"
          },
          {
            "name": "marginRequired",
            "type": "u64"
          },
          {
            "name": "marginSaved",
            "type": "u64"
          },
          {
            "name": "legCount",
            "type": "u8"
          },
          {
            "name": "ts",
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "marketConfig",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "marketIndex",
            "type": "u8"
          },
          {
            "name": "symbol",
            "type": {
              "array": [
                "u8",
                16
              ]
            }
          },
          {
            "name": "tickSize",
            "type": "u64"
          },
          {
            "name": "lotSize",
            "type": "u64"
          },
          {
            "name": "maxLeverage",
            "type": "u8"
          },
          {
            "name": "vault",
            "type": "pubkey"
          },
          {
            "name": "authority",
            "type": "pubkey"
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "order",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "orderId",
            "type": "u64"
          },
          {
            "name": "owner",
            "type": "pubkey"
          },
          {
            "name": "price",
            "type": "u64"
          },
          {
            "name": "size",
            "type": "u64"
          },
          {
            "name": "timestamp",
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "orderType",
      "type": {
        "kind": "enum",
        "variants": [
          {
            "name": "limit"
          },
          {
            "name": "market"
          }
        ]
      }
    },
    {
      "name": "orderbookState",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "marketIndex",
            "type": "u8"
          },
          {
            "name": "bids",
            "type": {
              "vec": {
                "defined": {
                  "name": "order"
                }
              }
            }
          },
          {
            "name": "asks",
            "type": {
              "vec": {
                "defined": {
                  "name": "order"
                }
              }
            }
          },
          {
            "name": "lastTradePrice",
            "type": "u64"
          },
          {
            "name": "sequence",
            "type": "u64"
          },
          {
            "name": "nextOrderId",
            "type": "u64"
          },
          {
            "name": "fundingRateBps",
            "type": "i64"
          },
          {
            "name": "lastFundingTs",
            "type": "i64"
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "partialLiquidationEvent",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "marketIndex",
            "type": "u8"
          },
          {
            "name": "trader",
            "type": "pubkey"
          },
          {
            "name": "liquidator",
            "type": "pubkey"
          },
          {
            "name": "closedSize",
            "type": "u64"
          },
          {
            "name": "closedNotional",
            "type": "u64"
          },
          {
            "name": "restoredHealthBps",
            "type": "i64"
          },
          {
            "name": "liquidationFee",
            "type": "u64"
          },
          {
            "name": "liquidatorBounty",
            "type": "u64"
          },
          {
            "name": "insuranceShare",
            "type": "u64"
          },
          {
            "name": "badDebt",
            "type": "u64"
          },
          {
            "name": "fullClose",
            "type": "bool"
          },
          {
            "name": "ts",
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "positionAccount",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "user",
            "type": "pubkey"
          },
          {
            "name": "marketIndex",
            "type": "u8"
          },
          {
            "name": "side",
            "type": {
              "defined": {
                "name": "positionSide"
              }
            }
          },
          {
            "name": "size",
            "type": "u64"
          },
          {
            "name": "entryPrice",
            "type": "u64"
          },
          {
            "name": "marginAllocated",
            "type": "u64"
          },
          {
            "name": "lastFundingTs",
            "type": "i64"
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "positionSide",
      "type": {
        "kind": "enum",
        "variants": [
          {
            "name": "flat"
          },
          {
            "name": "long"
          },
          {
            "name": "short"
          }
        ]
      }
    },
    {
      "name": "priceFeed",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "marketIndex",
            "type": "u8"
          },
          {
            "name": "markPrice",
            "type": "u64"
          },
          {
            "name": "indexPrice",
            "type": "u64"
          },
          {
            "name": "lastUpdateTs",
            "type": "i64"
          },
          {
            "name": "publisher",
            "type": "pubkey"
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "riskEngine",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "marketIndex",
            "type": "u8"
          },
          {
            "name": "returns",
            "type": {
              "vec": "i64"
            }
          },
          {
            "name": "head",
            "type": "u16"
          },
          {
            "name": "count",
            "type": "u16"
          },
          {
            "name": "lastPrice",
            "type": "u64"
          },
          {
            "name": "leverageCap",
            "type": "u8"
          },
          {
            "name": "priceBandBps",
            "type": "u16"
          },
          {
            "name": "circuitBreaker",
            "type": "bool"
          },
          {
            "name": "lastUpdateTs",
            "type": "i64"
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "riskUpdated",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "marketIndex",
            "type": "u8"
          },
          {
            "name": "realizedVolBps",
            "type": "u64"
          },
          {
            "name": "leverageCap",
            "type": "u8"
          },
          {
            "name": "circuitBreaker",
            "type": "bool"
          },
          {
            "name": "ts",
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "side",
      "type": {
        "kind": "enum",
        "variants": [
          {
            "name": "long"
          },
          {
            "name": "short"
          }
        ]
      }
    },
    {
      "name": "socializedLossEvent",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "marketIndex",
            "type": "u8"
          },
          {
            "name": "badDebt",
            "type": "u64"
          },
          {
            "name": "accountsHaircut",
            "type": "u32"
          },
          {
            "name": "ts",
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "tournamentRequested",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "epoch",
            "type": "u64"
          },
          {
            "name": "candidates",
            "type": "u32"
          },
          {
            "name": "prizePool",
            "type": "u64"
          },
          {
            "name": "ts",
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "tournamentSettled",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "epoch",
            "type": "u64"
          },
          {
            "name": "winner",
            "type": "pubkey"
          },
          {
            "name": "prize",
            "type": "u64"
          },
          {
            "name": "candidates",
            "type": "u32"
          },
          {
            "name": "vrfResult",
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "ts",
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "triggerFired",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "marketIndex",
            "type": "u8"
          },
          {
            "name": "user",
            "type": "pubkey"
          },
          {
            "name": "kind",
            "type": {
              "defined": {
                "name": "triggerKind"
              }
            }
          },
          {
            "name": "triggerPrice",
            "type": "u64"
          },
          {
            "name": "markPrice",
            "type": "u64"
          },
          {
            "name": "size",
            "type": "u64"
          },
          {
            "name": "ts",
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "triggerKind",
      "type": {
        "kind": "enum",
        "variants": [
          {
            "name": "stopLoss"
          },
          {
            "name": "takeProfit"
          }
        ]
      }
    },
    {
      "name": "triggerOrder",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "kind",
            "type": {
              "defined": {
                "name": "triggerKind"
              }
            }
          },
          {
            "name": "triggerPrice",
            "type": "u64"
          },
          {
            "name": "size",
            "type": "u64"
          },
          {
            "name": "fireSide",
            "type": {
              "defined": {
                "name": "side"
              }
            }
          }
        ]
      }
    },
    {
      "name": "triggerOrders",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "user",
            "type": "pubkey"
          },
          {
            "name": "marketIndex",
            "type": "u8"
          },
          {
            "name": "triggers",
            "type": {
              "vec": {
                "defined": {
                  "name": "triggerOrder"
                }
              }
            }
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "winnerRecord",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "epoch",
            "type": "u64"
          },
          {
            "name": "winner",
            "type": "pubkey"
          },
          {
            "name": "prize",
            "type": "u64"
          },
          {
            "name": "vrfResult",
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "candidates",
            "type": "u32"
          },
          {
            "name": "ts",
            "type": "i64"
          }
        ]
      }
    }
  ]
};
