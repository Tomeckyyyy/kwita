/**
 * Program IDL in camelCase format in order to be used in JS/TS.
 *
 * Note that this is only a type helper and is not the actual IDL. The original
 * IDL can be found at `target/idl/kwita.json`.
 */
export type Kwita = {
  "address": "GB8MgJJggQM7uiHwWy9nuL5AZnGbFraHVharujHKXAgk",
  "metadata": {
    "name": "kwita",
    "version": "0.1.0",
    "spec": "0.1.0",
    "description": "Kwita: kredyt kupiecki bez banku (mutual credit) na Solanie"
  },
  "instructions": [
    {
      "name": "createCircle",
      "discriminator": [
        186,
        99,
        49,
        131,
        31,
        51,
        13,
        198
      ],
      "accounts": [
        {
          "name": "creator",
          "writable": true,
          "signer": true
        },
        {
          "name": "circle",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  105,
                  114,
                  99,
                  108,
                  101
                ]
              },
              {
                "kind": "account",
                "path": "creator"
              },
              {
                "kind": "arg",
                "path": "circleId"
              }
            ]
          }
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
              },
              {
                "kind": "account",
                "path": "circle"
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
          "name": "circleId",
          "type": "u64"
        },
        {
          "name": "depositAmount",
          "type": "u64"
        },
        {
          "name": "salesLimitBps",
          "type": "u16"
        },
        {
          "name": "perCounterpartyCap",
          "type": "u64"
        },
        {
          "name": "maxSalesCredit",
          "type": "u64"
        },
        {
          "name": "defaultAfterSecs",
          "type": "i64"
        }
      ]
    },
    {
      "name": "declareDefault",
      "discriminator": [
        111,
        69,
        178,
        74,
        121,
        205,
        118,
        251
      ],
      "accounts": [
        {
          "name": "caller",
          "signer": true
        },
        {
          "name": "circle",
          "writable": true
        },
        {
          "name": "member",
          "writable": true
        }
      ],
      "args": []
    },
    {
      "name": "giveGuarantee",
      "discriminator": [
        175,
        80,
        152,
        210,
        163,
        83,
        66,
        103
      ],
      "accounts": [
        {
          "name": "guarantor",
          "writable": true,
          "signer": true
        },
        {
          "name": "circle"
        },
        {
          "name": "guarantorMember",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  109,
                  101,
                  109,
                  98,
                  101,
                  114
                ]
              },
              {
                "kind": "account",
                "path": "circle"
              },
              {
                "kind": "account",
                "path": "guarantor"
              }
            ]
          }
        },
        {
          "name": "beneficiaryMember",
          "writable": true
        },
        {
          "name": "guarantee",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  103,
                  117,
                  97,
                  114,
                  97,
                  110,
                  116,
                  101,
                  101
                ]
              },
              {
                "kind": "account",
                "path": "circle"
              },
              {
                "kind": "account",
                "path": "guarantor"
              },
              {
                "kind": "account",
                "path": "beneficiaryMember.owner",
                "account": "member"
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
          "name": "amount",
          "type": "u64"
        }
      ]
    },
    {
      "name": "join",
      "discriminator": [
        206,
        55,
        2,
        106,
        113,
        220,
        17,
        163
      ],
      "accounts": [
        {
          "name": "owner",
          "writable": true,
          "signer": true
        },
        {
          "name": "circle",
          "writable": true
        },
        {
          "name": "member",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  109,
                  101,
                  109,
                  98,
                  101,
                  114
                ]
              },
              {
                "kind": "account",
                "path": "circle"
              },
              {
                "kind": "account",
                "path": "owner"
              }
            ]
          }
        },
        {
          "name": "collateralMint"
        },
        {
          "name": "ownerToken",
          "writable": true
        },
        {
          "name": "vault",
          "writable": true
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
      "args": []
    },
    {
      "name": "leave",
      "discriminator": [
        59,
        234,
        148,
        108,
        107,
        149,
        173,
        112
      ],
      "accounts": [
        {
          "name": "owner",
          "signer": true
        },
        {
          "name": "circle",
          "writable": true
        },
        {
          "name": "member",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  109,
                  101,
                  109,
                  98,
                  101,
                  114
                ]
              },
              {
                "kind": "account",
                "path": "circle"
              },
              {
                "kind": "account",
                "path": "owner"
              }
            ]
          }
        },
        {
          "name": "collateralMint"
        },
        {
          "name": "ownerToken",
          "writable": true
        },
        {
          "name": "vault",
          "writable": true
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        }
      ],
      "args": [
        {
          "name": "forfeitPositive",
          "type": "bool"
        }
      ]
    },
    {
      "name": "pay",
      "discriminator": [
        119,
        18,
        216,
        65,
        192,
        117,
        122,
        220
      ],
      "accounts": [
        {
          "name": "buyer",
          "writable": true,
          "signer": true
        },
        {
          "name": "circle"
        },
        {
          "name": "buyerMember",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  109,
                  101,
                  109,
                  98,
                  101,
                  114
                ]
              },
              {
                "kind": "account",
                "path": "circle"
              },
              {
                "kind": "account",
                "path": "buyer"
              }
            ]
          }
        },
        {
          "name": "sellerMember",
          "writable": true
        },
        {
          "name": "pair",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  97,
                  105,
                  114
                ]
              },
              {
                "kind": "account",
                "path": "circle"
              },
              {
                "kind": "account",
                "path": "sellerMember.owner",
                "account": "member"
              },
              {
                "kind": "account",
                "path": "buyer"
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
          "name": "amount",
          "type": "u64"
        },
        {
          "name": "invoiceRef",
          "type": "string"
        }
      ]
    },
    {
      "name": "redeem",
      "discriminator": [
        184,
        12,
        86,
        149,
        70,
        196,
        97,
        225
      ],
      "accounts": [
        {
          "name": "owner",
          "signer": true
        },
        {
          "name": "circle",
          "writable": true
        },
        {
          "name": "member",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  109,
                  101,
                  109,
                  98,
                  101,
                  114
                ]
              },
              {
                "kind": "account",
                "path": "circle"
              },
              {
                "kind": "account",
                "path": "owner"
              }
            ]
          }
        },
        {
          "name": "collateralMint"
        },
        {
          "name": "ownerToken",
          "writable": true
        },
        {
          "name": "vault",
          "writable": true
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
      "name": "withdrawGuarantee",
      "discriminator": [
        90,
        175,
        173,
        229,
        183,
        148,
        41,
        242
      ],
      "accounts": [
        {
          "name": "guarantor",
          "signer": true
        },
        {
          "name": "circle"
        },
        {
          "name": "guarantorMember",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  109,
                  101,
                  109,
                  98,
                  101,
                  114
                ]
              },
              {
                "kind": "account",
                "path": "circle"
              },
              {
                "kind": "account",
                "path": "guarantor"
              }
            ]
          }
        },
        {
          "name": "beneficiaryMember",
          "writable": true
        },
        {
          "name": "guarantee",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  103,
                  117,
                  97,
                  114,
                  97,
                  110,
                  116,
                  101,
                  101
                ]
              },
              {
                "kind": "account",
                "path": "circle"
              },
              {
                "kind": "account",
                "path": "guarantor"
              },
              {
                "kind": "account",
                "path": "beneficiaryMember.owner",
                "account": "member"
              }
            ]
          }
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
      "name": "circle",
      "discriminator": [
        27,
        59,
        8,
        117,
        62,
        199,
        222,
        252
      ]
    },
    {
      "name": "guarantee",
      "discriminator": [
        198,
        16,
        124,
        172,
        230,
        249,
        200,
        37
      ]
    },
    {
      "name": "member",
      "discriminator": [
        54,
        19,
        162,
        21,
        29,
        166,
        17,
        198
      ]
    },
    {
      "name": "pair",
      "discriminator": [
        85,
        72,
        49,
        176,
        182,
        228,
        141,
        82
      ]
    }
  ],
  "events": [
    {
      "name": "circleCreated",
      "discriminator": [
        210,
        110,
        215,
        179,
        247,
        145,
        243,
        135
      ]
    },
    {
      "name": "guaranteeChanged",
      "discriminator": [
        78,
        232,
        239,
        129,
        73,
        35,
        99,
        111
      ]
    },
    {
      "name": "memberDefaulted",
      "discriminator": [
        35,
        214,
        165,
        144,
        170,
        135,
        39,
        136
      ]
    },
    {
      "name": "memberJoined",
      "discriminator": [
        156,
        199,
        149,
        88,
        193,
        203,
        191,
        210
      ]
    },
    {
      "name": "memberLeft",
      "discriminator": [
        48,
        83,
        72,
        92,
        111,
        227,
        133,
        142
      ]
    },
    {
      "name": "paymentMade",
      "discriminator": [
        227,
        251,
        123,
        16,
        133,
        220,
        83,
        242
      ]
    },
    {
      "name": "redeemed",
      "discriminator": [
        14,
        29,
        183,
        71,
        31,
        165,
        107,
        38
      ]
    }
  ],
  "errors": [
    {
      "code": 6000,
      "name": "invalidParams",
      "msg": "Nieprawidłowe parametry kręgu"
    },
    {
      "code": 6001,
      "name": "zeroAmount",
      "msg": "Kwota musi być większa od zera"
    },
    {
      "code": 6002,
      "name": "selfPayment",
      "msg": "Nie można płacić samemu sobie"
    },
    {
      "code": 6003,
      "name": "notActive",
      "msg": "Firma nie jest aktywna w kręgu"
    },
    {
      "code": 6004,
      "name": "limitExceeded",
      "msg": "Przekroczony limit kredytu"
    },
    {
      "code": 6005,
      "name": "invoiceRefTooLong",
      "msg": "Numer faktury jest za długi (max 64 bajty)"
    },
    {
      "code": 6006,
      "name": "selfGuarantee",
      "msg": "Nie można poręczyć za siebie"
    },
    {
      "code": 6007,
      "name": "guaranteeTooSmall",
      "msg": "Poręczenie jest mniejsze niż kwota wycofania"
    },
    {
      "code": 6008,
      "name": "guaranteeInUse",
      "msg": "Poręczenie jest w użyciu: firma przekroczyłaby limit"
    },
    {
      "code": 6009,
      "name": "insufficientBalance",
      "msg": "Za małe saldo"
    },
    {
      "code": 6010,
      "name": "reserveEmpty",
      "msg": "Rezerwa nie ma tyle tPLN"
    },
    {
      "code": 6011,
      "name": "hasGivenGuarantees",
      "msg": "Firma ma aktywne poręczenia za inne firmy"
    },
    {
      "code": 6012,
      "name": "depositTooSmallToLeave",
      "msg": "Kaucja nie pokrywa salda ujemnego"
    },
    {
      "code": 6013,
      "name": "positiveBalance",
      "msg": "Saldo dodatnie: wydaj je, wymień albo oddaj Rezerwie"
    },
    {
      "code": 6014,
      "name": "notNegative",
      "msg": "Saldo nie jest ujemne"
    },
    {
      "code": 6015,
      "name": "tooEarly",
      "msg": "Termin niewypłacalności jeszcze nie minął"
    },
    {
      "code": 6016,
      "name": "invalidGuaranteeAccount",
      "msg": "Nieprawidłowe konto poręczenia"
    },
    {
      "code": 6017,
      "name": "mathOverflow",
      "msg": "Przepełnienie arytmetyczne"
    },
    {
      "code": 6018,
      "name": "wrongCircle",
      "msg": "Konto należy do innego kręgu"
    }
  ],
  "types": [
    {
      "name": "circle",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "creator",
            "type": "pubkey"
          },
          {
            "name": "circleId",
            "type": "u64"
          },
          {
            "name": "collateralMint",
            "type": "pubkey"
          },
          {
            "name": "vault",
            "type": "pubkey"
          },
          {
            "name": "depositAmount",
            "type": "u64"
          },
          {
            "name": "salesLimitBps",
            "type": "u16"
          },
          {
            "name": "perCounterpartyCap",
            "type": "u64"
          },
          {
            "name": "maxSalesCredit",
            "type": "u64"
          },
          {
            "name": "defaultAfterSecs",
            "type": "i64"
          },
          {
            "name": "reserveBalance",
            "type": "i64"
          },
          {
            "name": "reserveUsdc",
            "type": "u64"
          },
          {
            "name": "unbackedLoss",
            "type": "u64"
          },
          {
            "name": "memberCount",
            "type": "u32"
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "circleCreated",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "circle",
            "type": "pubkey"
          },
          {
            "name": "creator",
            "type": "pubkey"
          },
          {
            "name": "circleId",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "guarantee",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "guarantor",
            "type": "pubkey"
          },
          {
            "name": "beneficiary",
            "type": "pubkey"
          },
          {
            "name": "amount",
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
      "name": "guaranteeChanged",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "circle",
            "type": "pubkey"
          },
          {
            "name": "guarantor",
            "type": "pubkey"
          },
          {
            "name": "beneficiary",
            "type": "pubkey"
          },
          {
            "name": "amount",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "member",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "circle",
            "type": "pubkey"
          },
          {
            "name": "owner",
            "type": "pubkey"
          },
          {
            "name": "balance",
            "type": "i64"
          },
          {
            "name": "deposit",
            "type": "u64"
          },
          {
            "name": "countedSales",
            "type": "u64"
          },
          {
            "name": "guaranteesGiven",
            "type": "u64"
          },
          {
            "name": "guaranteesReceived",
            "type": "u64"
          },
          {
            "name": "negativeSince",
            "type": "i64"
          },
          {
            "name": "status",
            "type": {
              "defined": {
                "name": "memberStatus"
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
      "name": "memberDefaulted",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "circle",
            "type": "pubkey"
          },
          {
            "name": "owner",
            "type": "pubkey"
          },
          {
            "name": "debt",
            "type": "u64"
          },
          {
            "name": "fromDeposit",
            "type": "u64"
          },
          {
            "name": "fromGuarantors",
            "type": "u64"
          },
          {
            "name": "unbacked",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "memberJoined",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "circle",
            "type": "pubkey"
          },
          {
            "name": "owner",
            "type": "pubkey"
          },
          {
            "name": "deposit",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "memberLeft",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "circle",
            "type": "pubkey"
          },
          {
            "name": "owner",
            "type": "pubkey"
          },
          {
            "name": "coveredDebt",
            "type": "u64"
          },
          {
            "name": "forfeited",
            "type": "u64"
          },
          {
            "name": "refunded",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "memberStatus",
      "type": {
        "kind": "enum",
        "variants": [
          {
            "name": "active"
          },
          {
            "name": "exited"
          },
          {
            "name": "defaulted"
          }
        ]
      }
    },
    {
      "name": "pair",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "counted",
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
      "name": "paymentMade",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "circle",
            "type": "pubkey"
          },
          {
            "name": "buyer",
            "type": "pubkey"
          },
          {
            "name": "seller",
            "type": "pubkey"
          },
          {
            "name": "amount",
            "type": "u64"
          },
          {
            "name": "counted",
            "type": "u64"
          },
          {
            "name": "invoiceRef",
            "type": "string"
          }
        ]
      }
    },
    {
      "name": "redeemed",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "circle",
            "type": "pubkey"
          },
          {
            "name": "owner",
            "type": "pubkey"
          },
          {
            "name": "amount",
            "type": "u64"
          }
        ]
      }
    }
  ],
  "constants": [
    {
      "name": "circleSeed",
      "type": "bytes",
      "value": "[99, 105, 114, 99, 108, 101]"
    },
    {
      "name": "guaranteeSeed",
      "type": "bytes",
      "value": "[103, 117, 97, 114, 97, 110, 116, 101, 101]"
    },
    {
      "name": "memberSeed",
      "type": "bytes",
      "value": "[109, 101, 109, 98, 101, 114]"
    },
    {
      "name": "pairSeed",
      "type": "bytes",
      "value": "[112, 97, 105, 114]"
    },
    {
      "name": "vaultSeed",
      "type": "bytes",
      "value": "[118, 97, 117, 108, 116]"
    }
  ]
};
